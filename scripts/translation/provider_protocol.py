"""翻訳プロバイダー共通のテキスト入出力。"""

from typing import Protocol


class TextTranslator(Protocol):
    """英語のテキストから日本語を返す翻訳機。"""

    def translate(self, input_text: str) -> str:
        """入力テキストの日本語訳を返す。"""
        ...
