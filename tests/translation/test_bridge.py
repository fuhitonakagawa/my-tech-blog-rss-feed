"""翻訳ブリッジの入力・失敗分離・モデル検証。"""

import hashlib
import json
import logging
import zipfile
from pathlib import Path

import pytest
from runtime import safe_event
from setup_model import installed_files_match, reset_package_directories, verify_archive
from translate import parse_request, translate_texts


class FakeTranslation:
    """個別の失敗を再現できる翻訳器。"""

    def translate(self, input_text: str) -> str:
        """入力に応じた日本語または例外を返す。"""
        if input_text == "failure":
            raise RuntimeError("private input must not be logged")
        return f"日本語:{input_text}"


def test_request_preserves_text_order() -> None:
    """入力順序と空文字を維持する。"""
    texts = ["Title", "Summary", ""]
    assert (
        parse_request(
            {
                "sourceLanguage": "en",
                "targetLanguage": "ja",
                "texts": texts,
            }
        )
        == texts
    )


@pytest.mark.parametrize(
    "payload",
    [
        None,
        {"sourceLanguage": "ja", "targetLanguage": "en", "texts": []},
        {"sourceLanguage": "en", "targetLanguage": "ja", "texts": "text"},
        {"sourceLanguage": "en", "targetLanguage": "ja", "texts": [1]},
    ],
)
def test_rejects_invalid_request(payload: object) -> None:
    """翻訳方向やテキスト型が不正なリクエストを拒否する。"""
    with pytest.raises((ValueError, TypeError)):
        parse_request(payload)


def test_partial_failure_keeps_other_translations(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """個別失敗を空文字で示し、本文や例外メッセージをログへ含めない。"""
    with caplog.at_level(logging.WARNING):
        assert translate_texts(
            ["Title", "failure", "", "Summary"], FakeTranslation()
        ) == [
            "日本語:Title",
            "",
            "",
            "日本語:Summary",
        ]
    assert "private input" not in caplog.text
    assert "translation_item_failed" in caplog.text


def test_logs_allow_only_diagnostic_fields() -> None:
    """イベント・logger・相関IDとJST時刻を保持し秘密情報を除去する。"""
    result = safe_event(
        None,
        "info",
        {
            "event": "unknown private text",
            "logger": "translation",
            "level": "info",
            "correlation_id": "test-correlation",
            "token": "secret",
            "input": "private input",
        },
    )
    assert result["event"] == "library_log"
    assert result["logger"] == "translation"
    assert result["correlation_id"] == "test-correlation"
    assert str(result["timestamp"]).endswith("+09:00")
    assert "secret" not in json.dumps(result)
    assert "private" not in json.dumps(result)


def test_archive_checksum_and_safe_paths(tmp_path: Path) -> None:
    """ハッシュ一致と安全な展開先を両方要求する。"""
    archive = tmp_path / "model.zip"
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("model/metadata.json", "{}")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    verify_archive(archive, {"sha256": digest})
    with pytest.raises(ValueError, match="ハッシュ"):
        verify_archive(archive, {"sha256": "0" * 64})
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("../outside", "data")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    with pytest.raises(ValueError, match="展開先"):
        verify_archive(archive, {"sha256": digest})


def test_cached_model_files_must_match_archive(tmp_path: Path) -> None:
    """モデルキャッシュの欠落や変更を検出する。"""
    archive = tmp_path / "model.zip"
    packages = tmp_path / "packages"
    packages.mkdir()
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("model/metadata.json", "{}")
    assert not installed_files_match(archive, packages)
    (packages / "model").mkdir()
    metadata = packages / "model/metadata.json"
    metadata.write_text("{}")
    assert installed_files_match(archive, packages)
    metadata.write_text("changed")
    assert not installed_files_match(archive, packages)


def test_model_reset_does_not_follow_symlink(tmp_path: Path) -> None:
    """キャッシュ内のリンクを削除してもリンク先のデータを変更しない。"""
    archive = tmp_path / "model.zip"
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("model/metadata.json", "{}")
    packages = tmp_path / "packages"
    packages.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "keep").write_text("keep")
    (packages / "model").symlink_to(outside, target_is_directory=True)
    reset_package_directories(archive, packages)
    assert not (packages / "model").exists()
    assert (outside / "keep").read_text() == "keep"
