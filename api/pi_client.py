# pi_client.py
import json, time, os
from evdev import InputDevice, categorize, ecodes
import websocket

SERVER = os.getenv('SERVER', 'ws://server-ip:4000')  # change to your server IP or domain
DEVICE_ID = os.getenv('DEVICE_ID', 'raspi-01')
DEVICE_PATH = os.getenv('DEVICE_PATH', '/dev/input/event0')  # set to your keyboard input device

def main():
    ws = websocket.create_connection(SERVER)
    # init as device
    ws.send(json.dumps({"role":"device","deviceId": DEVICE_ID}))
    dev = InputDevice(DEVICE_PATH)
    seq = 0
    for ev in dev.read_loop():
        if ev.type == ecodes.EV_KEY:
            key = categorize(ev)
            state = key.keystate  # 0=up,1=down,2=hold
            typ = None
            if state == 1: typ = "keydown"
            elif state == 0: typ = "keyup"
            if not typ: continue
            payload = {
                "deviceId": DEVICE_ID,
                "seq": seq,
                "type": typ,
                "code": key.keycode,
                "char": None,
                "ts": int(time.time()*1000)
            }
            seq += 1
            try:
                ws.send(json.dumps(payload))
            except Exception as e:
                print("send failed:", e)
                break

if __name__ == "__main__":
    main()
