"""検証済みのローカルArgos翻訳モデル。"""

import importlib.metadata
import json

from offline_sentence_splitter import configure_sentence_splitter
from provider_protocol import TextTranslator
from runtime import model_marker, provider_id


def load_translation(model: dict[str, str]) -> TextTranslator:
    """検証済みのバージョンと翻訳方向に一致するモデルを取得する。"""
    if importlib.metadata.version("argostranslate") != model["argosVersion"]:
        raise ValueError("Argosのバージョンが一致しません")
    marker = model_marker(model)
    if json.loads(marker.read_text()) != {"providerId": provider_id(model)}:
        raise ValueError("検証済みのモデルがありません")
    import argostranslate.package
    import argostranslate.translate

    configure_sentence_splitter()

    packages = argostranslate.package.get_installed_packages()
    candidates = [
        package
        for package in packages
        if package.from_code == model["sourceLanguage"]
        and package.to_code == model["targetLanguage"]
        and str(package.package_version) == model["packageVersion"]
    ]
    if len(candidates) != 1:
        raise ValueError("指定された翻訳モデルがありません")
    package = candidates[0]
    translation: TextTranslator = argostranslate.translate.CachedTranslation(
        argostranslate.translate.PackageTranslation(
            argostranslate.translate.Language(package.from_code, package.from_name),
            argostranslate.translate.Language(package.to_code, package.to_name),
            package,
        )
    )
    return translation


class PipelineTranslator:
    """同じリクエスト内で検証済みモデルを順に適用する。"""

    def __init__(self, stages: list[TextTranslator], max_text_bytes: int) -> None:
        self.stages = stages
        self.max_text_bytes = max_text_bytes

    def translate(self, input_text: str) -> str:
        """途中段階が失敗した場合は、中間言語の文を成功結果として返さない。"""
        result = input_text
        for stage in self.stages:
            if len(result.encode("utf-8")) > self.max_text_bytes:
                raise ValueError("中間翻訳が入力上限を超えています")
            result = stage.translate(result)
            if not isinstance(result, str) or not result.strip():
                raise ValueError("中間翻訳が空です")
        return result
