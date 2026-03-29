import os
import base64
import threading
import logging

from dotenv import load_dotenv
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit

from e2b import Sandbox, PtySize

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.urandom(24).hex()

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    ping_timeout=120,
    ping_interval=25,
    max_http_buffer_size=10 * 1024 * 1024,
)

E2B_API_KEY = os.environ.get("VITE_E2B_API_KEY", "")

sandbox_store = {
    "sandbox": None,
    "pty_handle": None,
    "pty_pid": None,
    "pty_thread": None,
    "connected": False,
    "lock": threading.Lock(),
}


@app.route("/")
def index():
    has_api_key = bool(E2B_API_KEY)
    return render_template("index.html", has_api_key=has_api_key)


@app.route("/api/status")
def status():
    return jsonify({
        "connected": sandbox_store["connected"],
        "sandbox_id": sandbox_store["sandbox"].sandbox_id if sandbox_store["sandbox"] else None,
        "has_api_key": bool(E2B_API_KEY),
    })


def _stream_pty_output(handle, sid):
    try:
        for stdout, stderr, pty_data in handle:
            if pty_data is not None:
                encoded = base64.b64encode(pty_data).decode("ascii")
                socketio.emit("pty_output", {"data": encoded}, to=sid)
            elif stdout is not None:
                socketio.emit("pty_output", {
                    "data": base64.b64encode(stdout.encode("utf-8")).decode("ascii")
                }, to=sid)
            elif stderr is not None:
                socketio.emit("pty_output", {
                    "data": base64.b64encode(stderr.encode("utf-8")).decode("ascii")
                }, to=sid)
    except Exception as e:
        logger.error(f"PTY stream error: {e}")
        socketio.emit("pty_error", {"error": str(e)}, to=sid)
    finally:
        socketio.emit("pty_closed", {}, to=sid)


@socketio.on("connect")
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit("status", {
        "connected": sandbox_store["connected"],
        "sandbox_id": sandbox_store["sandbox"].sandbox_id if sandbox_store["sandbox"] else None,
    })


@socketio.on("disconnect")
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")


@socketio.on("create_sandbox")
def handle_create_sandbox(data):
    if not E2B_API_KEY:
        emit("error", {"message": "E2B API key not configured. Set VITE_E2B_API_KEY in your .env file."})
        return

    if sandbox_store["connected"]:
        emit("error", {"message": "Sandbox already running. Stop it first."})
        return

    emit("status_update", {"status": "connecting", "message": "Creating sandbox..."})

    try:
        with sandbox_store["lock"]:
            sandbox = Sandbox.create(
                api_key=E2B_API_KEY,
                timeout=3600,
            )
            sandbox_store["sandbox"] = sandbox
            sandbox_store["connected"] = True

        logger.info(f"Sandbox created: {sandbox.sandbox_id}")

        emit("sandbox_created", {
            "sandbox_id": sandbox.sandbox_id,
            "connected": True,
        })

        cols = data.get("cols", 80)
        rows = data.get("rows", 24)

        pty_handle = sandbox.pty.create(
            size=PtySize(rows=rows, cols=cols),
            envs={
                "TERM": "xterm-256color",
                "COLORTERM": "truecolor",
                "LANG": "en_US.UTF-8",
                "LC_ALL": "en_US.UTF-8",
                "FORCE_COLOR": "3",
                "TERM_PROGRAM": "xterm",
            },
            timeout=0,
        )

        sandbox_store["pty_handle"] = pty_handle
        sandbox_store["pty_pid"] = pty_handle.pid

        logger.info(f"PTY created with PID: {pty_handle.pid}")

        emit("pty_ready", {"pid": pty_handle.pid})

        sid = request.sid
        pty_thread = threading.Thread(
            target=_stream_pty_output,
            args=(pty_handle, sid),
            daemon=True,
        )
        pty_thread.start()
        sandbox_store["pty_thread"] = pty_thread

    except Exception as e:
        logger.error(f"Failed to create sandbox: {e}")
        sandbox_store["connected"] = False
        sandbox_store["sandbox"] = None
        emit("error", {"message": f"Failed to create sandbox: {str(e)}"})


@socketio.on("pty_input")
def handle_pty_input(data):
    if not sandbox_store["connected"] or not sandbox_store["sandbox"]:
        return

    try:
        input_data = data.get("data", "")
        pid = sandbox_store["pty_pid"]
        if pid is not None:
            if isinstance(input_data, str):
                sandbox_store["sandbox"].pty.send_stdin(pid, input_data.encode("utf-8"))
            else:
                raw = base64.b64decode(input_data)
                sandbox_store["sandbox"].pty.send_stdin(pid, raw)
    except Exception as e:
        logger.error(f"Failed to send PTY input: {e}")


@socketio.on("pty_binary_input")
def handle_pty_binary_input(data):
    if not sandbox_store["connected"] or not sandbox_store["sandbox"]:
        return

    try:
        raw = base64.b64decode(data.get("data", ""))
        pid = sandbox_store["pty_pid"]
        if pid is not None:
            sandbox_store["sandbox"].pty.send_stdin(pid, raw)
    except Exception as e:
        logger.error(f"Failed to send binary PTY input: {e}")


@socketio.on("pty_resize")
def handle_pty_resize(data):
    if not sandbox_store["connected"] or not sandbox_store["sandbox"]:
        return

    try:
        cols = data.get("cols", 80)
        rows = data.get("rows", 24)
        pid = sandbox_store["pty_pid"]
        if pid is not None:
            sandbox_store["sandbox"].pty.resize(pid, PtySize(rows=rows, cols=cols))
    except Exception as e:
        logger.error(f"Failed to resize PTY: {e}")


@socketio.on("stop_sandbox")
def handle_stop_sandbox():
    try:
        with sandbox_store["lock"]:
            if sandbox_store["pty_handle"]:
                try:
                    sandbox_store["pty_handle"].kill()
                except Exception:
                    pass
                sandbox_store["pty_handle"] = None
                sandbox_store["pty_pid"] = None

            if sandbox_store["sandbox"]:
                try:
                    sandbox_store["sandbox"].kill()
                except Exception:
                    pass
                sandbox_store["sandbox"] = None

            sandbox_store["connected"] = False

        logger.info("Sandbox stopped")
        emit("sandbox_stopped", {"connected": False})

    except Exception as e:
        logger.error(f"Failed to stop sandbox: {e}")
        emit("error", {"message": f"Failed to stop sandbox: {str(e)}"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    logger.info(f"Starting E2B Terminal server on port {port}")
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=False,
        allow_unsafe_werkzeug=True,
    )