"""標準入力のテキスト集合を選択した翻訳機で翻訳し、標準出力にJSONを返す。"""

import contextlib
import json
import logging
import sys

from config import CONFIG
from provider_factory import create_provider, translation_identity
from provider_protocol import TextTranslator
from runtime import configure_logging, translation_route

LOGGER = logging.getLogger(__name__)
MAX_INPUT_BYTES = 32 * 1024 * 1024


def parse_request(value: object) -> tuple[str, list[str]]:
    """翻訳リクエストの形式とテキストを検証する。"""
    if not isinstance(value, dict):
        raise TypeError("翻訳リクエストが不正です")
    source = value.get("sourceLanguage")
    target = value.get("targetLanguage")
    if not isinstance(source, str) or not isinstance(target, str):
        raise TypeError("翻訳言語が不正です")
    translation_route(source, target)
    texts = value.get("texts")
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise ValueError("textsは文字列の配列が必要です")
    return source, [str(text) for text in texts]


def translate_texts(texts: list[str], translation: TextTranslator) -> list[str]:
    """入力順に翻訳し、個別の失敗は空文字として返す。"""
    results: list[str] = []
    for index, text in enumerate(texts, start=1):
        if not text.strip():
            results.append(text)
            continue
        try:
            if len(text.encode("utf-8")) > CONFIG.text_max_bytes:
                raise ValueError("翻訳テキストが上限を超えています")
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
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError("翻訳リクエストが上限を超えています")
        source, texts = parse_request(json.loads(raw))
        identity = translation_identity(CONFIG, source)
        with contextlib.redirect_stdout(sys.stderr):
            results = translate_texts(texts, create_provider(source_language=source))
        print(
            json.dumps(
                {"providerId": identity, "translations": results},
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
