"""Argosが呼ぶ文分割器を同梱モデル・通信禁止の設定に限定する。"""

import json
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory

_configured = False


def all_caps_feature(unit: str) -> int:
    """固定モデルが要求する文字列全体の大文字フラグを返す。"""
    return int(unit.isupper())


def register_tokenizer_features() -> None:
    """固定モデルの入力次元を維持するために必要な特徴量を登録する。"""
    from stanza.models.tokenization import data

    data.PER_CHAR_FEAT_FUNCS["all_caps"] = all_caps_feature
    data.KNOWN_FEAT_FUNCS = data.KNOWN_FEAT_FUNCS | {"all_caps"}


def prepare_tokenizer_model(source: Path, destination: Path) -> None:
    """同梱モデルの重みを保持し、推論用のメタデータを補完する。"""
    import torch

    checkpoint: object = torch.load(source, map_location="cpu", weights_only=True)
    if (
        not isinstance(checkpoint, dict)
        or not isinstance(checkpoint.get("config"), dict)
        or not isinstance(checkpoint.get("model"), dict)
    ):
        raise TypeError("英語トークナイザーのモデルが不正です")
    checkpoint["config"].setdefault("feat_dropout", 0.0)
    checkpoint["config"].setdefault("use_dictionary", False)
    checkpoint["config"].setdefault(
        "use_mwt", any(key.startswith("mwt_clf.") for key in checkpoint["model"])
    )
    checkpoint.setdefault("lexicon", None)
    torch.save(checkpoint, destination)


def configure_sentence_splitter() -> None:
    """英語の文分割器を1プロセス内で共有し、モデルの自動取得を禁止する。"""
    global _configured
    if _configured:
        return
    import argostranslate.translate
    import stanza

    register_tokenizer_features()
    pipeline_factory = stanza.Pipeline

    @lru_cache(maxsize=1)
    def offline_pipeline(
        lang: str, dir: str, processors: str, use_gpu: bool, logging_level: str
    ) -> object:
        """固定モデルの英語トークナイザーだけを読み込む。"""
        if lang != "en" or processors != "tokenize" or use_gpu:
            raise ValueError("英語CPUトークナイザーだけを利用できます")
        resources: object = json.loads((Path(dir) / "resources.json").read_text())
        if not isinstance(resources, dict) or not isinstance(resources.get("en"), dict):
            raise TypeError("英語トークナイザーの定義が不正です")
        resources["en"].setdefault("packages", {})
        with TemporaryDirectory(prefix="argos-resources-") as temporary:
            resource_file = Path(temporary) / "resources.json"
            resource_file.write_text(json.dumps(resources), encoding="utf-8")
            model_file = Path(temporary) / "tokenizer.pt"
            prepare_tokenizer_model(Path(dir) / "en/tokenize/ewt.pt", model_file)
            pipeline: object = pipeline_factory(
                lang=lang,
                dir=dir,
                processors=processors,
                package="ewt",
                use_gpu=False,
                logging_level=logging_level,
                download_method=None,
                resources_filepath=str(resource_file),
                tokenize_model_path=str(model_file),
            )
        return pipeline

    argostranslate.translate.stanza.Pipeline = offline_pipeline
    _configured = True
