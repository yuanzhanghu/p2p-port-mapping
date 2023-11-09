from flask import Flask, request, jsonify, Response
from flask import stream_with_context
import json
import httplib2
from signal_management import SignalManagement
from flask_cors import CORS
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from datetime import datetime
import time
import random
import string
import queue
import threading

# A dictionary to store tokens and their corresponding verification codes
verification_codes = {}

app = Flask(__name__)
app.response_chunks = {}
ws_message_queue = queue.Queue()
app.signal_manager = SignalManagement(ws_message_queue)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
CORS(app)
http = httplib2.Http(timeout=5)


def websocket_listener():
    global ws_message_queue
    while True:
        session_id, message = ws_message_queue.get()
        print(f"websocket_listener: session_id {session_id}, message: {message}")
        socketio.emit(
            "message", message, room=session_id, namespace="/api/p2pmapping/websocket"
        )


@socketio.on("connect", namespace="/api/p2pmapping/websocket")
def handle_connect():
    print("Client connected", flush=True)


@socketio.on("disconnect", namespace="/api/p2pmapping/websocket")
def handle_disconnect():
    print("Client disconnected", flush=True)


def custom_emit(msgtype, data):
    print(f"socket.io sent back msgtype:{msgtype}, {data}")
    emit(msgtype, data)


@socketio.on("server_keep_alive", namespace="/api/p2pmapping/websocket")
def handle_server_keep_alive(data):
    ws_session_id = request.sid
    result = app.signal_manager.server_keep_alive(data, ws_session_id)
    custom_emit("message", result)


@socketio.on("client_keep_alive", namespace="/api/p2pmapping/websocket")
def handle_client_keep_alive(data):
    ws_session_id = request.sid
    result = app.signal_manager.client_keep_alive(data, ws_session_id)
    custom_emit("message", result)


@socketio.on("server_register", namespace="/api/p2pmapping/websocket")
def handle_server_register(data):
    ws_session_id = request.sid
    result = app.signal_manager.server_register(data, ws_session_id)
    custom_emit("message", result)


@socketio.on("client_register", namespace="/api/p2pmapping/websocket")
def handle_client_register(data):
    ws_session_id = request.sid
    result = app.signal_manager.client_register(data, ws_session_id)
    custom_emit("message", result)


@socketio.on("get_messagebox", namespace="/api/p2pmapping/websocket")
def handle_get_messagebox(data):
    result = app.signal_manager.get_messagebox()
    custom_emit("message", result)


@socketio.on("client_send_signal", namespace="/api/p2pmapping/websocket")
def handle_client_send_signal(data):
    print(f"client_send_signal, data:{data}", flush=True)
    result = app.signal_manager.client_send_signal(data)
    print(f"client_send_signal result: {result}")
    custom_emit("message", result)


@socketio.on("server_send_signal", namespace="/api/p2pmapping/websocket")
def handle_server_send_signal(data):
    print(f"server_send_signal, data:{data}", flush=True)
    result = app.signal_manager.server_send_signal(data)
    print(f"server_send_signal, data:{data}", flush=True)
    custom_emit("message", result)


if __name__ == "__main__":
    listener_thread = threading.Thread(target=websocket_listener)
    listener_thread.start()

    app.run(debug=False, host="0.0.0.0", port=5000)
    socketio.run(app, debug=True, use_reloader=False)
