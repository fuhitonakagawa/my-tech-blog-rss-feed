"""検証済みのローカルArgos翻訳モデル。"""

import importlib.metadata
import json
import os
from pathlib import Path

from offline_sentence_splitter import configure_sentence_splitter
from provider_protocol import TextTranslator
from runtime import provider_id


def load_translation(model: dict[str, str]) -> TextTranslator:
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
    translation: TextTranslator = argostranslate.translate.get_translation_from_codes(
        "en", "ja"
    )
    return translation
