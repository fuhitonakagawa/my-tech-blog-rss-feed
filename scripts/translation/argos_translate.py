"""標準入力のテキスト集合をArgosで翻訳し、標準出力にJSONを返す。"""

import contextlib
import importlib.metadata
import json
import logging
import os
import sys
from pathlib import Path
from typing import Protocol

from offline_sentence_splitter import configure_sentence_splitter
from runtime import (
    configure_environment,
    configure_logging,
    load_model_definition,
    provider_id,
)

LOGGER = logging.getLogger(__name__)
MAX_INPUT_BYTES = 32 * 1024 * 1024


class LocalTranslation(Protocol):
    """Argosの翻訳オブジェクトが提供する最小インターフェース。"""

    def translate(self, input_text: str) -> str:
        """入力テキストの翻訳を返す。"""
        ...


def parse_request(value: object) -> list[str]:
    """英日翻訳リクエストの形式とテキストを検証する。"""
    if not isinstance(value, dict):
        raise TypeError("翻訳リクエストが不正です")
    if value.get("sourceLanguage") != "en" or value.get("targetLanguage") != "ja":
        raise ValueError("英日翻訳だけを受け付けます")
    texts = value.get("texts")
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise ValueError("textsは文字列の配列が必要です")
    return [str(text) for text in texts]


def load_translation(model: dict[str, str]) -> LocalTranslation:
    """検証済みのバージョンに一致する英日翻訳モデルを取得する。"""
    if importlib.metadata.version("argostranslate") != model["argosVersion"]:
        raise ValueError("Argosのバージョンが一致しません")
    marker = Path(os.environ["ARGOS_PACKAGES_DIR"]) / "verified-model.json"
    if json.loads(marker.read_text()) != {"providerId": provider_id(model)}:
        raise ValueError("検証済みのモデルがありません")
    import argostranslate.package
    import argostranslate.translate

    configure_sentence_splitter()

    packages = argostranslate.package.get_installed_packages()
    if not any(
        package.from_code == "en"
        and package.to_code == "ja"
        and str(package.package_version) == model["packageVersion"]
        for package in packages
    ):
        raise ValueError("英日翻訳モデルがありません")
    translation: LocalTranslation = argostranslate.translate.get_translation_from_codes(
        "en", "ja"
    )
    return translation


def translate_texts(texts: list[str], translation: LocalTranslation) -> list[str]:
    """入力順に翻訳し、個別の失敗は空文字として返す。"""
    results: list[str] = []
    for index, text in enumerate(texts, start=1):
        if not text.strip():
            results.append(text)
            continue
        try:
            result = translation.translate(text)
            if not isinstance(result, str) or not result.strip():
                raise ValueError("翻訳結果が空です")
            results.append(result)
        except Exception as error:  # noqa: BLE001 -- 翻訳失敗時も他の記事を配信する。
            LOGGER.warning(
                "translation_item_failed", extra={"error_type": type(error).__name__}
            )
            results.append("")
        if index % 25 == 0 or index == len(texts):
            LOGGER.info(
                "translation_progress", extra={"processed": index, "total": len(texts)}
            )
    return results


def main() -> int:
    """JSONプロトコルで一括翻訳を実行する。"""
    try:
        configure_logging()
        configure_environment()
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError("翻訳リクエストが上限を超えています")
        texts = parse_request(json.loads(raw))
        model = load_model_definition()
        with contextlib.redirect_stdout(sys.stderr):
            results = translate_texts(texts, load_translation(model))
        print(
            json.dumps(
                {"providerId": provider_id(model), "translations": results},
                ensure_ascii=False,
            )
        )
        LOGGER.info("translation_complete")
        return 0
    except Exception as error:  # noqa: BLE001 -- 例外の本文を出力せず終了状態を通知する。
        LOGGER.error("translation_failed", extra={"error_type": type(error).__name__})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
