"""文分割器の通信禁止とプロセス内共有を検証する。"""

import json
import sys
from pathlib import Path
from types import ModuleType

import offline_sentence_splitter
import pytest
import torch


def test_sentence_splitter_is_local_and_shared(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Argosの呼び出しを固定トークナイザーと通信禁止設定に制限する。"""
    calls: list[dict[str, object]] = []
    sentinel = object()
    source_resources = '{"en":{"tokenize":{"ewt":{}}}}'
    (tmp_path / "resources.json").write_text(source_resources)
    model_file = tmp_path / "en/tokenize/ewt.pt"
    model_file.parent.mkdir(parents=True)
    torch.save({"config": {"lang": "en"}, "model": {}, "vocab": {}}, model_file)
    original_model = model_file.read_bytes()

    def pipeline_factory(**kwargs: object) -> object:
        """渡された設定を記録する。"""
        calls.append(kwargs)
        resources = json.loads(Path(str(kwargs["resources_filepath"])).read_text())
        assert resources["en"]["packages"] == {}
        checkpoint = torch.load(str(kwargs["tokenize_model_path"]), weights_only=True)
        assert checkpoint["config"]["feat_dropout"] == 0.0
        assert checkpoint["config"]["use_mwt"] is False
        assert checkpoint["config"]["use_dictionary"] is False
        assert checkpoint["lexicon"] is None
        return sentinel

    stanza_module = ModuleType("stanza")
    stanza_module.Pipeline = pipeline_factory  # type: ignore[attr-defined]
    translate_module = ModuleType("argostranslate.translate")
    translate_module.stanza = stanza_module  # type: ignore[attr-defined]
    argos_module = ModuleType("argostranslate")
    argos_module.translate = translate_module  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "stanza", stanza_module)
    monkeypatch.setitem(sys.modules, "argostranslate", argos_module)
    monkeypatch.setitem(sys.modules, "argostranslate.translate", translate_module)
    monkeypatch.setattr(offline_sentence_splitter, "_configured", False)
    monkeypatch.setattr(
        offline_sentence_splitter, "register_tokenizer_features", lambda: None
    )
    offline_sentence_splitter.configure_sentence_splitter()
    offline_sentence_splitter.configure_sentence_splitter()
    arguments = {
        "lang": "en",
        "dir": str(tmp_path),
        "processors": "tokenize",
        "use_gpu": False,
        "logging_level": "WARNING",
    }
    pipeline = stanza_module.Pipeline
    assert pipeline(**arguments) is sentinel
    assert pipeline(**arguments) is sentinel
    assert len(calls) == 1
    assert calls[0]["download_method"] is None
    assert calls[0]["package"] == "ewt"
    assert (tmp_path / "resources.json").read_text() == source_resources
    assert model_file.read_bytes() == original_model
    with pytest.raises(ValueError):
        pipeline(**{**arguments, "lang": "fr"})


@pytest.mark.parametrize(
    ("unit", "expected"), [("AWS", 1), ("Aws", 0), (" A", 1), ("a", 0)]
)
def test_model_uppercase_feature(unit: str, expected: int) -> None:
    """固定モデルの大文字特徴量を保持する。"""
    assert offline_sentence_splitter.all_caps_feature(unit) == expected
