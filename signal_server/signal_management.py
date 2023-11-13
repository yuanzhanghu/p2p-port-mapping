import json
import os

class SignalManagement(object):
    """
    p2pmapping signal management
    """
    CONFIG_FILE = "p2p_mapping_config.json"
    MAPPING_FILE = "p2p_global_mapping.json"
    
    def __init__(self, websocket_msg_queue):
        self.global_mapping = self._load_from_file(self.MAPPING_FILE)
        self.config = self._load_from_file(self.CONFIG_FILE)
        self.websocket_msg_queue = websocket_msg_queue
    
    def _load_from_file(self, file_name):
        if os.path.exists(file_name):
            with open(file_name, 'r') as file:
                return json.load(file)
        return {}
    
    def _save_to_file(self, data, file_name):
        with open(file_name, 'w') as file:
            json.dump(data, file, indent=4)
    
    def save_config(self):
        self._save_to_file(self.config, self.CONFIG_FILE)
    
    def save_mapping(self):
        self._save_to_file(self.global_mapping, self.MAPPING_FILE)

    def client_send_signal(self, data):
        server_key, clientId, event, buf = (
            data["serverKey"],
            data["clientId"],
            data["event"],
            data["buf"],
        )
        if server_key in self.global_mapping:
            if clientId not in self.global_mapping[server_key]["clientlist"]:
                return {
                    "msgType": "errMsg",
                    "data": {
                        "errMsg": f"clientId: {clientId} does not exist or is not registered"
                    },
                }
            # Forwarding the signal to the server (the exact forwarding mechanism depends on your implementation)
            ws_session_id = self.global_mapping[server_key].get("ws_session_id")
            if ws_session_id:
                self.websocket_msg_queue.put(
                    (
                        ws_session_id,
                        {
                            "msgType": "clientSignal",
                            "data": {"event": event, "buf": buf, "clientId": clientId},
                        },
                    )
                )
                return {"msgType": "clientSignalForwarded", "data": {"success": True}}
            else:
                return {
                    "msgType": "errMsg",
                    "data": {
                        "errMsg": f"server_key:{server_key} websocket not established"
                    },
                }
        return {
            "msgType": "errMsg",
            "data": {"errMsg": f"serverKey: {server_key} does not exist"},
        }

    def server_send_signal(self, data):
        # Extract necessary details
        server_key, clientId, event, buf = (
            data["serverKey"],
            data["clientId"],
            data["event"],
            data["buf"],
        )
        if server_key in self.global_mapping:
            if clientId not in self.global_mapping[server_key]["clientlist"]:
                return {
                    "msgType": "errMsg",
                    "data": {
                        "errMsg": f"clientId: {clientId} does not exist or is not registered"
                    },
                }
            # Forwarding the signal to the client (the exact forwarding mechanism depends on your implementation)
            ws_session_id = self.global_mapping.get(clientId, {}).get("ws_session_id")
            if ws_session_id:
                self.websocket_msg_queue.put(
                    (
                        ws_session_id,
                        {
                            "msgType": "serverSignal",
                            "data": {"event": event, "buf": buf, "clientId": clientId},
                        },
                    )
                )
                return {"msgType": "serverSignalForwarded", "data": {"success": True}}
            else:
                return {
                    "msgType": "errMsg",
                    "data": {
                        "errMsg": f"clientId:{clientId} websocket not established"
                    },
                }
        else:
            return {
                "msgType": "errMsg",
                "data": {"errMsg": f"serverKey: {server_key} does not exist"},
            }

    def server_keep_alive(self, data, ws_session_id):
        print(f"server_keep_alive, data:{data}", flush=True)
        server_key = data["serverKey"]
        self.global_mapping.setdefault(server_key, {})
        self.global_mapping[server_key]["ws_session_id"] = ws_session_id
        self.save_mapping()
        return {"data": "OK"}

    def client_keep_alive(self, data, ws_session_id):
        print(f"client_keep_alive, data:{data}", flush=True)
        clientId = data["clientId"]
        self.global_mapping.setdefault(clientId, {})
        self.global_mapping[clientId]["ws_session_id"] = ws_session_id
        self.save_mapping()
        return {"data": "OK"}

    def server_register(self, data, ws_session_id):
        print(f"server_register, data:{data}", flush=True)
        server_key = data["serverKey"]
        self.global_mapping.setdefault(server_key, {})
        self.global_mapping[server_key].setdefault("clientlist", [])
        self.global_mapping[server_key]["ws_session_id"] = ws_session_id
        self.save_mapping()
        return {
            "msgType": "server_registered",
            "data": {"success": True, "serverKey": server_key},
        }

    def client_register(self, data, ws_session_id):
        print(f"client_register, data:{data}", flush=True)
        server_key, clientId = data["serverKey"], data["clientId"]
        self.global_mapping[server_key]["clientlist"].append(clientId)
        self.global_mapping.setdefault(clientId, {})
        self.global_mapping[clientId]["ws_session_id"] = ws_session_id
        self.save_mapping()
        return {
            "msgType": "client_registered",
            "data": {"clientId": clientId, "server_key": server_key,
                     "success": True},
        }

    def get_messagebox(self):
        return {"messagebox": self.config.get("messagebox", "")}
