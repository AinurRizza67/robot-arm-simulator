"""Uji jembatan dengan robot virtual (tanpa robot fisik). Jalankan: python tests/test_bridge.py"""

import json
import os
import queue
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BRIDGE = os.path.join(HERE, "..", "robot_bridge.py")
SDK = os.path.join(HERE, "..", "sdk")  # official JAKA SDK, copied here locally (not committed)

p = subprocess.Popen(
    [sys.executable, "-u", BRIDGE, "--sdk", SDK],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding="utf-8",
)
inbox, events = {}, queue.Queue()


def reader():
    for line in p.stdout:
        m = json.loads(line)
        if "id" in m:
            inbox[m["id"]] = m
        else:
            events.put(m)


threading.Thread(target=reader, daemon=True).start()
nid = [0]


def call(cmd, timeout=10, **args):
    nid[0] += 1
    i = nid[0]
    p.stdin.write(json.dumps({"id": i, "cmd": cmd, "args": args}) + "\n")
    p.stdin.flush()
    t0 = time.time()
    while i not in inbox:
        if time.time() - t0 > timeout:
            raise TimeoutError(cmd)
        time.sleep(0.01)
    return inbox.pop(i)


def last_state():
    st, t0 = None, time.time()
    while True:
        try:
            e = events.get(timeout=0.3) if st is None else events.get_nowait()
        except queue.Empty:
            if st is not None or time.time() - t0 > 3:
                return st
            continue
        if e["event"] == "state" and e["data"].get("q"):
            st = e["data"]


RES = []


def T(name, cond, info=""):
    RES.append(cond)
    print(("PASS " if cond else "FAIL ") + name + ((" | " + str(info)) if info else ""))


h = call("hello")
T("hello: python dan SDK jkrc termuat", h["ok"] and h["data"]["sdk"], h["data"].get("sdk_error"))
pg = call("ping", ip="127.0.0.1", timeout=1000)
T("ping 127.0.0.1 tercapai", pg["ok"] and pg["data"]["reachable"], pg["data"].get("ms"))
bad = call("ping", ip="1.2.3.4; del x")
T("ping menolak IP tidak valid", bad["ok"] and not bad["data"]["reachable"])
r = call("move_j", q=[0] * 6)
T("gerak ditolak sebelum tersambung", not r["ok"], r.get("error"))
c = call("connect", mode="virtual", cap=50)
T("connect virtual", c["ok"], c)
r = call("move_j", q=[0, 90, -90, 90, 90, 0])
T("gerak ditolak sebelum power on dan enable", not r["ok"], r.get("error"))
T("power on", call("power", on=True)["ok"])
T("enable", call("enable", on=True)["ok"])
r = call("move_j", q=[0, 95, -90, 90, 90, 0], speed=80)
T("move_j diterima", r["ok"], r.get("error"))
time.sleep(1.2)
st = last_state()
T("state 10 Hz: sudut sendi 2 sampai di 95 derajat", st and abs(st["q"][1] - 95) < 0.05, st and st["q"])
r = call("move_j", q=[0, 300, 0, 0, 0, 0])
T("batas sendi ditolak (J2 300 derajat)", not r["ok"], r.get("error"))

# jog kontinu dengan sinyal hidup, lalu dilepas tanpa jog_stop: watchdog harus menghentikan
st0 = last_state() or st
r = call("jog", kind="joint", axis=0, dir=1, speed=20)
for _ in range(5):
    call("jog_alive")
    time.sleep(0.15)
time.sleep(1.0)
a = last_state()["q"][0]
time.sleep(0.6)
b = last_state()["q"][0]
T(
    "jog kontinu bergerak lalu dihentikan watchdog saat sinyal hilang",
    a > st0["q"][0] + 1 and abs(b - a) < 0.01,
    (st0["q"][0], a, b),
)

# jog kartesian langkah 10 mm sumbu Z
z0 = last_state()["tcp"][2]
call("jog", kind="cart", axis=2, dir=1, step=10, speed=50)
time.sleep(1.5)
z1 = last_state()["tcp"][2]
T("jog kartesian +10 mm sumbu Z", abs((z1 - z0) - 10) < 0.2, (z0, z1))

# move_l
r = call("move_l", pose=[450, 100, 400, 180, 0, -90], speed=60)
time.sleep(4.0)
tcp = last_state()["tcp"]
T("move_l ke (450, 100, 400) mm", r["ok"] and max(abs(tcp[i] - v) for i, v in enumerate([450, 100, 400])) < 0.5, tcp)

# program Python
code = """
q = robot.joints()
print('mulai', [round(v,1) for v in q])
tgt = robot.ik(400, -150, 350)
robot.move_j(tgt, speed=60)
p = robot.tcp()
print('selesai', [round(v,1) for v in p[:3]])
"""
r = call("run", code=code)
logs, status = [], None
t0 = time.time()
while time.time() - t0 < 15 and status not in ("done", "error", "stopped"):
    try:
        e = events.get(timeout=0.5)
    except queue.Empty:
        continue
    if e["event"] == "log":
        logs.append(e["data"]["text"])
    if e["event"] == "prog":
        status = e["data"]["status"]
fin = [l for l in logs if l.startswith("selesai")]
T(
    "program: IK lalu move_j selesai di (400, -150, 350)",
    status == "done" and fin and "400.0, -150.0, 350.0" in fin[0],
    (status, logs[-3:]),
)

r = call("run", code="while True:\n    x = 1\n")
time.sleep(0.5)
call("stop_program")
status = None
t0 = time.time()
while time.time() - t0 < 5 and status not in ("stopped", "error", "done"):
    try:
        e = events.get(timeout=0.5)
    except queue.Empty:
        continue
    if e["event"] == "prog" and e["data"]["status"] != "running":
        status = e["data"]["status"]
T("program loop tak berujung bisa dihentikan", status == "stopped", status)

r = call("run", code="print(1/0)")
errs = []
t0 = time.time()
status = None
while time.time() - t0 < 5 and status is None:
    try:
        e = events.get(timeout=0.5)
    except queue.Empty:
        continue
    if e["event"] == "log" and e["data"]["stream"] == "err":
        errs.append(e["data"]["text"])
    if e["event"] == "prog" and e["data"]["status"] != "running":
        status = e["data"]["status"]
T(
    "galat program dilaporkan dengan nomor baris",
    status == "error" and any("ZeroDivisionError" in x for x in errs),
    errs,
)

r = call("connect", mode="real", ip="")
T("mode nyata menolak IP kosong", not r["ok"], r.get("error"))
T("disconnect", call("disconnect")["ok"])
p.stdin.close()
p.wait(5)
print("\n%d dari %d lulus" % (sum(RES), len(RES)))
sys.exit(0 if all(RES) else 1)
