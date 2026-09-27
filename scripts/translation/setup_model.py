"""固定した英日モデルを検証してArgosへインストールする。"""

import contextlib
import hashlib
import http.client
import importlib.metadata
import json
import logging
import os
import shutil
import sys
import urllib.parse
import zipfile
from pathlib import Path, PurePosixPath

from runtime import (
    configure_environment,
    configure_logging,
    load_model_definition,
    provider_id,
)

LOGGER = logging.getLogger(__name__)
MAX_MODEL_BYTES = 512 * 1024 * 1024


def verify_archive(archive: Path, model: dict[str, str]) -> None:
    """SHA-256と展開先の安全性が一致するモデルだけを許可する。"""
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != model["sha256"]:
        raise ValueError("モデルのハッシュが一致しません")
    with zipfile.ZipFile(archive) as package:
        for name in package.namelist():
            entry = PurePosixPath(name)
            if entry.is_absolute() or ".." in entry.parts or "\\" in name:
                raise ValueError("モデルの展開先が不正です")


def download_model(archive: Path, model: dict[str, str]) -> None:
    """許可した配信元からサイズ・通信時間の制限付きでモデルを取得する。"""
    url = urllib.parse.urlsplit(model["url"])
    if (
        url.scheme != "https"
        or url.netloc != "argos-net.com"
        or not url.path.startswith("/v1/")
        or url.query
        or url.fragment
    ):
        raise ValueError("モデルの配信元が不正です")
    temporary = archive.with_suffix(".download")
    try:
        with (
            contextlib.closing(
                http.client.HTTPSConnection("argos-net.com", timeout=60)
            ) as connection,
            temporary.open("wb") as output,
        ):
            connection.request("GET", url.path)
            response = connection.getresponse()
            if response.status != 200:
                raise ValueError("モデルの取得に失敗しました")
            total = 0
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_MODEL_BYTES:
                    raise ValueError("モデルのサイズが上限を超えています")
                output.write(chunk)
        verify_archive(temporary, model)
        temporary.replace(archive)
    finally:
        temporary.unlink(missing_ok=True)


def installed_files_match(archive: Path, packages: Path) -> bool:
    """展開済みファイルが固定アーカイブと一致するか検証する。"""
    with zipfile.ZipFile(archive) as package:
        for entry in package.infolist():
            if entry.is_dir():
                continue
            installed = packages / entry.filename
            if (
                not installed.is_file()
                or installed.is_symlink()
                or not installed.resolve().is_relative_to(packages.resolve())
            ):
                return False
            with installed.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").digest()
            if digest != hashlib.sha256(package.read(entry)).digest():
                return False
    return True


def reset_package_directories(archive: Path, packages: Path) -> None:
    """検証済みアーカイブの対象だけを空にし、既存のリンクを展開に使わない。"""
    with zipfile.ZipFile(archive) as package:
        roots = {PurePosixPath(name).parts[0] for name in package.namelist()}
    for name in roots:
        destination = packages / name
        if destination.is_symlink() or destination.is_file():
            destination.unlink()
        elif destination.is_dir():
            shutil.rmtree(destination)


def setup_model() -> None:
    """モデルとバージョンが一致する場合は保存済みファイルを利用する。"""
    import argostranslate.package

    model = load_model_definition()
    if importlib.metadata.version("argostranslate") != model["argosVersion"]:
        raise ValueError("Argosのバージョンが一致しません")
    packages = Path(os.environ["ARGOS_PACKAGES_DIR"])
    packages.mkdir(parents=True, exist_ok=True)
    marker = packages / "verified-model.json"
    expected = {"providerId": provider_id(model)}
    archive = packages.parent / "en-ja.argosmodel"
    if archive.is_file():
        verify_archive(archive, model)
    else:
        download_model(archive, model)
    try:
        saved_marker = json.loads(marker.read_text())
    except (OSError, ValueError):
        saved_marker = None
    if saved_marker == expected and installed_files_match(archive, packages):
        LOGGER.info("model_ready")
        return
    reset_package_directories(archive, packages)
    argostranslate.package.install_from_path(archive)
    marker.write_text(json.dumps(expected), encoding="utf-8")
    LOGGER.info("model_ready")


def main() -> int:
    """環境とモデルを検証し、失敗時は非ゼロで終了する。"""
    try:
        configure_logging()
        configure_environment()
        with contextlib.redirect_stdout(sys.stderr):
            setup_model()
        return 0
    except Exception as error:  # noqa: BLE001 -- 設定・通信・モデルの失敗を非ゼロ終了で通知する。
        LOGGER.error("model_setup_failed", extra={"error_type": type(error).__name__})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
