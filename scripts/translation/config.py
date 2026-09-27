"""Gitで管理する翻訳設定。AWSの認証情報は保存しない。"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TranslationConfig:
    """翻訳機・実行上限・非機密のAWS接続先。"""

    provider: Literal["argos", "bedrock", "amazon-translate"] = "argos"
    timeout_ms: int = 1_200_000
    cpu_threads: int = 2
    packages_dir: str = ".argos/packages"
    runtime_dir: str = ".argos/runtime"
    log_level: str = "INFO"
    aws_region: str = ""
    aws_role_arn: str = ""
    bedrock_model_id: str = ""
    bedrock_max_tokens: int = 4096
    bedrock_temperature: float = 0.0
    aws_request_timeout_seconds: int = 60
    aws_max_attempts: int = 2
    max_input_bytes: int = 10_000


CONFIG = TranslationConfig()
