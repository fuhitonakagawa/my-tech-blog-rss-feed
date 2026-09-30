"""翻訳機の選択・有効性・キャッシュ識別子。"""

import hashlib
import json
import re
from dataclasses import asdict

from config import CONFIG, TranslationConfig
from provider_protocol import TextTranslator
from runtime import configure_environment, load_model_definition, provider_id


def validate_config(config: TranslationConfig) -> None:
    """不正な実行上限やワークフロー出力への改行混入を拒否する。"""
    if config.provider not in {"argos", "bedrock", "amazon-translate"}:
        raise ValueError("翻訳機の指定が不正です")
    if (
        any(
            value <= 0
            for value in (
                config.timeout_ms,
                config.batch_timeout_ms,
                config.batch_max_texts,
                config.batch_max_bytes,
                config.text_max_bytes,
                config.cpu_threads,
                config.bedrock_max_tokens,
                config.aws_request_timeout_seconds,
                config.aws_max_attempts,
                config.max_input_bytes,
            )
        )
        or not 0 <= config.bedrock_temperature <= 1
    ):
        raise ValueError("翻訳の実行上限が不正です")
    if (
        config.batch_timeout_ms > config.timeout_ms
        or config.text_max_bytes > config.batch_max_bytes
        or config.batch_max_bytes > 32 * 1024 * 1024
    ):
        raise ValueError("翻訳バッチの上限が不正です")
    if config.aws_region and not re.fullmatch(
        r"[a-z]{2}(?:-[a-z]+)+-\d+", config.aws_region
    ):
        raise ValueError("AWSリージョンが不正です")
    if config.aws_role_arn and not re.fullmatch(
        r"arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role/[A-Za-z0-9_+=,.@/-]+",
        config.aws_role_arn,
    ):
        raise ValueError("AWSロールARNが不正です")


def describe_provider(config: TranslationConfig = CONFIG) -> dict[str, object]:
    """通信せず、設定の有効性と翻訳キャッシュの識別子を返す。"""
    validate_config(config)
    configured = config.provider == "argos" or bool(
        config.aws_region
        and config.aws_role_arn
        and (config.provider != "bedrock" or config.bedrock_model_id.strip())
    )
    if config.provider == "argos":
        identity = provider_id(load_model_definition())
    else:
        from aws_provider import BEDROCK_SYSTEM_PROMPT

        settings = asdict(config)
        for key in (
            "aws_role_arn",
            "packages_dir",
            "runtime_dir",
            "log_level",
            "cpu_threads",
            "timeout_ms",
            "batch_timeout_ms",
            "batch_max_texts",
            "batch_max_bytes",
            "text_max_bytes",
        ):
            settings.pop(key)
        settings["prompt"] = (
            BEDROCK_SYSTEM_PROMPT if config.provider == "bedrock" else ""
        )
        digest = hashlib.sha256(
            json.dumps(settings, sort_keys=True).encode()
        ).hexdigest()
        identity = f"{config.provider}:v1:en-ja:{digest}"
    return {
        "provider": config.provider,
        "providerId": identity,
        "limits": {
            "totalTimeoutMs": config.timeout_ms,
            "batchTimeoutMs": config.batch_timeout_ms,
            "maxBatchTexts": config.batch_max_texts,
            "maxBatchBytes": config.batch_max_bytes,
            "maxTextBytes": config.text_max_bytes,
        },
        "configured": configured,
        "awsRegion": config.aws_region,
        "awsRoleArn": config.aws_role_arn,
    }


def create_provider(config: TranslationConfig = CONFIG) -> TextTranslator:
    """設定不足ならモデル導入やAWS認証探索より前に停止する。"""
    if not describe_provider(config)["configured"]:
        raise ValueError("AWS翻訳の接続先が未設定です")
    if config.provider == "argos":
        from argos_provider import load_translation

        configure_environment(config)
        return load_translation(load_model_definition())
    from aws_provider import create_aws_provider

    return create_aws_provider(config)


if __name__ == "__main__":
    print(json.dumps(describe_provider(), ensure_ascii=False))
