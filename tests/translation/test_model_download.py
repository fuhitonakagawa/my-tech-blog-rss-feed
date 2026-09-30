"""モデル取得の総期限・上限・失敗後の保存状態を実HTTPで検証する。"""

import hashlib
import http.client
import io
import threading
import time
import zipfile
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
import setup_model


@pytest.fixture
def model_server(monkeypatch: pytest.MonkeyPatch) -> Iterator[bytes]:
    """通信先をローカルへ限定し、低速な配信元も再現する。"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("model/metadata.json", "{}")
    payload = buffer.getvalue()

    class Handler(BaseHTTPRequestHandler):
        """正常・低速・HTTP失敗を返す配信元。"""

        def do_GET(self) -> None:
            """指定パスに対応する応答を返す。"""
            if self.path == "/v1/slow-headers":
                self.connection.sendall(b"HTTP/1.1 200 OK\r\nX-Slow: ")
                self.send_slowly()
                return
            self.send_response(503 if self.path == "/v1/fail" else 200)
            self.end_headers()
            if self.path == "/v1/slow":
                self.send_slowly()
            else:
                self.wfile.write(payload)

        def send_slowly(self) -> None:
            """無通信期限に達しない間隔で小さなデータを返す。"""
            for _ in range(100):
                try:
                    self.wfile.write(b"x")
                    self.wfile.flush()
                except OSError:
                    return
                time.sleep(0.01)

        def log_message(self, format: str, *args: object) -> None:
            """テスト用のHTTPアクセスログは出力しない。"""

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    monkeypatch.setattr(
        http.client,
        "HTTPSConnection",
        lambda host, timeout: http.client.HTTPConnection(
            "127.0.0.1", server.server_port, timeout=timeout
        ),
    )
    try:
        yield payload
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


@pytest.mark.parametrize("route", ["slow", "slow-headers"])
def test_total_deadline_preserves_archive(
    model_server: bytes,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    route: str,
) -> None:
    """ヘッダー・本文が継続到着しても総期限で止まり、保存済みモデルを壊さない。"""
    monkeypatch.setattr(setup_model, "MODEL_DOWNLOAD_TIMEOUT_SECONDS", 0.15)
    archive = tmp_path / "en-ja.argosmodel"
    archive.write_bytes(b"previous")
    started = time.monotonic()
    with pytest.raises(TimeoutError, match="総期限"):
        setup_model.download_model(
            archive,
            {
                "url": f"https://argos-net.com/v1/{route}",
                "sha256": hashlib.sha256(model_server).hexdigest(),
            },
        )
    assert time.monotonic() - started < 2
    assert archive.read_bytes() == b"previous"
    assert not archive.with_suffix(".download").exists()


def test_failed_download_can_retry(
    model_server: bytes, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """HTTP失敗・容量超過・ハッシュ違反の後も正常なモデルを保存できる。"""
    archive = tmp_path / "en-ja.argosmodel"
    model = {
        "url": "https://argos-net.com/v1/good",
        "sha256": hashlib.sha256(model_server).hexdigest(),
    }
    with pytest.raises(ValueError, match="取得に失敗"):
        setup_model.download_model(
            archive, {**model, "url": "https://argos-net.com/v1/fail"}
        )
    with monkeypatch.context() as limits:
        limits.setattr(setup_model, "MAX_MODEL_BYTES", len(model_server) - 1)
        with pytest.raises(ValueError, match="サイズ"):
            setup_model.download_model(archive, model)
    with pytest.raises(ValueError, match="ハッシュ"):
        setup_model.download_model(archive, {**model, "sha256": "wrong"})
    assert list(tmp_path.iterdir()) == []
    setup_model.download_model(archive, model)
    assert archive.read_bytes() == model_server
    assert list(tmp_path.iterdir()) == [archive]
