"""翻訳プロセスの設定と秘密情報を含まない診断ログ。"""

import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

import structlog
from config import CONFIG, TranslationConfig
from structlog.typing import EventDict, Processor, WrappedLogger

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALLOWED_FIELDS = {
    "event",
    "logger",
    "level",
    "timestamp",
    "correlation_id",
    "error_type",
    "processed",
    "total",
}
ALLOWED_EVENTS = {
    "model_ready",
    "translation_complete",
    "translation_progress",
    "translation_item_failed",
    "translation_failed",
    "model_setup_failed",
    "library_log",
}


def configure_environment(config: TranslationConfig = CONFIG) -> None:
    """環境設定を検証し、Argosの保存先をプロジェクト配下へ設定する。"""
    threads = str(config.cpu_threads)
    if int(threads) <= 0:
        raise ValueError("cpu_threadsには正の整数が必要です")
    os.environ["OMP_NUM_THREADS"] = threads
    os.environ["MKL_NUM_THREADS"] = threads
    packages = (PROJECT_ROOT / config.packages_dir).resolve()
    runtime = (PROJECT_ROOT / config.runtime_dir).resolve()
    os.environ["ARGOS_PACKAGES_DIR"] = str(packages)
    for variable, directory in (
        ("XDG_DATA_HOME", "data"),
        ("XDG_CACHE_HOME", "cache"),
        ("XDG_CONFIG_HOME", "config"),
    ):
        os.environ[variable] = str(runtime / directory)
    os.environ["ARGOS_DEVICE_TYPE"] = "cpu"
    os.environ["ARGOS_DEBUG"] = "0"
    os.environ["ARGOS_MODEL_PROVIDER"] = "OPENNMT"
    os.environ["ARGOS_STANZA_AVAILABLE"] = "1"
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"


def safe_event(_logger: WrappedLogger, _method: str, event: EventDict) -> EventDict:
    """許可した診断項目だけを出力し、ライブラリの本文をマスクする。"""
    if not isinstance(event.get("event"), str) or event["event"] not in ALLOWED_EVENTS:
        event["event"] = "library_log"
    event["timestamp"] = datetime.now(ZoneInfo("Asia/Tokyo")).isoformat()
    return {key: value for key, value in event.items() if key in ALLOWED_FIELDS}


def configure_logging() -> None:
    """stdlibとstructlogを標準エラーの1行JSONへ統一する。"""
    structlog.contextvars.bind_contextvars(correlation_id=str(uuid4()))
    processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.ExtraAdder(allow=["error_type", "processed", "total"]),
        structlog.processors.dict_tracebacks,
    ]
    structlog.configure(
        processors=[
            *processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
    )
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=processors,
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                safe_event,
                structlog.processors.JSONRenderer(ensure_ascii=False),
            ],
        )
    )
    logging.basicConfig(level=logging.ERROR, handlers=[handler], force=True)
    level_name = CONFIG.log_level.upper()
    level = logging.getLevelNamesMapping().get(level_name)
    if level is None:
        raise ValueError("log_levelが不正です")
    logging.getLogger().setLevel(level)
    logging.captureWarnings(True)


def load_model_definition(source: str = "en", target: str = "ja") -> dict[str, str]:
    """固定モデルのバージョン・取得元・検証用ハッシュを返す。"""
    if not all(re.fullmatch(r"[a-z]{2,3}", code) for code in (source, target)):
        raise ValueError("モデルの言語コードが不正です")
    file = (
        "model.json"
        if (source, target) == ("en", "ja")
        else f"models/{source}-{target}.json"
    )
    value: object = json.loads((Path(__file__).parent / file).read_text())
    keys = {
        "argosVersion",
        "packageVersion",
        "sourceLanguage",
        "targetLanguage",
        "url",
        "sha256",
    }
    if not isinstance(value, dict) or set(value) != keys:
        raise ValueError("モデル定義が不正です")
    if not all(isinstance(item, str) and item for item in value.values()):
        raise ValueError("モデル定義の値が不正です")
    if (
        value["sourceLanguage"] != source
        or value["targetLanguage"] != target
        or not re.fullmatch(r"[a-f0-9]{64}", value["sha256"])
    ):
        raise ValueError("モデル定義の翻訳方向・ハッシュが不正です")
    return {str(key): str(item) for key, item in value.items()}


def provider_id(model: dict[str, str]) -> str:
    """エンジン・翻訳方向・モデルのハッシュを含む識別子を返す。"""
    return (
        f"argos:{model['argosVersion']}:{model['sourceLanguage']}-{model['targetLanguage']}:"
        f"{model['packageVersion']}:{model['sha256']}:"
        f"{hashlib.sha256((PROJECT_ROOT / 'uv.lock').read_bytes()).hexdigest()}"
    )


def translation_route(
    source: str, target: str, config: TranslationConfig = CONFIG
) -> tuple[str, ...]:
    """明示的に許可された翻訳経路だけを返す。"""
    for route in config.translation_routes:
        if route[0] == source and route[-1] == target:
            return route
    raise ValueError("対応していない翻訳方向です")


def model_marker(model: dict[str, str]) -> Path:
    """モデルごとに独立した検証結果の保存先を返す。"""
    return (
        Path(os.environ["ARGOS_PACKAGES_DIR"])
        / f"verified-{model['sourceLanguage']}-{model['targetLanguage']}.json"
    )
