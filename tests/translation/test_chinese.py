"""中国語経由翻訳とモデル・言語境界を検証する。"""

from dataclasses import replace
from typing import cast

import pytest
from argos_provider import PipelineTranslator
from aws_provider import AmazonTranslateTranslator, TranslateClient
from config import TranslationConfig
from provider_factory import translation_identity, validate_config
from runtime import load_model_definition, provider_id
from translate import parse_request, translate_texts


def test_chinese_request_and_path_validation() -> None:
    """中国語を独立した原文言語として扱い、未定義の言語を拒否する。"""
    assert parse_request(
        {"sourceLanguage": "zh", "targetLanguage": "ja", "texts": ["机器人"]}
    ) == ("zh", ["机器人"])
    for code in ["cn", "fr", "../zh"]:
        with pytest.raises(ValueError):
            parse_request({"sourceLanguage": code, "targetLanguage": "ja", "texts": []})
    for routes in [(("zh", "en", "zh", "ja"),), (("en", "ja"), ("en", "zh", "ja"))]:
        with pytest.raises(ValueError):
            validate_config(replace(TranslationConfig(), translation_routes=routes))


def test_cache_identity_tracks_both_models_without_resetting_english(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """中国語モデルの変更は英語キャッシュへ影響せず、共有モデルの変更は両方へ反映する。"""
    config = TranslationConfig()
    english = translation_identity(config, "en")
    chinese = translation_identity(config, "zh")
    assert english == provider_id(load_model_definition())
    original = load_model_definition

    def changed(source: str = "en", target: str = "ja") -> dict[str, str]:
        model = original(source, target)
        return {**model, "sha256": "0" * 64} if source == "zh" else model

    monkeypatch.setattr("provider_factory.load_model_definition", changed)
    assert translation_identity(config, "en") == english
    assert translation_identity(config, "zh") != chinese


def test_failed_second_stage_does_not_publish_english_intermediate() -> None:
    """二段階目が失敗した入力だけを翻訳失敗として扱う。"""

    class First:
        """中国語から中間文を返す代替。"""

        def translate(self, input_text: str) -> str:
            """中間文を返す。"""
            return f"English:{input_text}"

    class Second:
        """中間文の失敗を再現する代替。"""

        def translate(self, input_text: str) -> str:
            """特定の入力だけ失敗させる。"""
            if input_text.endswith("bad"):
                raise ValueError("translation failed")
            return "日本語"

    assert translate_texts(
        ["good", "bad", "after"], PipelineTranslator([First(), Second()], 1024)
    ) == ["日本語", "", "日本語"]
    assert translate_texts(["good"], PipelineTranslator([First(), Second()], 5)) == [""]


def test_aws_chinese_uses_explicit_source_language() -> None:
    """AWSへ切り替えても中国語の入力を英語として送信しない。"""

    class Client:
        """中国語のAPI引数を検証する。"""

        def translate_text(self, **kwargs: object) -> dict[str, object]:
            """ネットワークを使わず引数を検証する。"""
            assert kwargs["SourceLanguageCode"] == "zh"
            assert kwargs["TargetLanguageCode"] == "ja"
            return {"TranslatedText": "ロボット"}

    translator = AmazonTranslateTranslator(
        cast(TranslateClient, Client()), TranslationConfig(), "zh"
    )
    assert translator.translate("机器人") == "ロボット"
