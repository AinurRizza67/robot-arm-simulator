"""Jembatan antara aplikasi JAKA Remake (Electron) dan robot JAKA ZU5.

Protokol: satu objek JSON per baris.
  masuk (stdin) : {"id": 1, "cmd": "connect", "args": {...}}
  keluar (stdout): {"id": 1, "ok": true, "data": ...}  atau  {"id": 1, "ok": false, "error": "..."}
  event          : {"event": "state" | "log" | "prog", "data": {...}}

Semua sudut yang lewat protokol ini adalah SUDUT MODEL dalam derajat (sama dengan simulator).
Konversi ke sudut controller (q_ctrl = sign * q_model + offset) hanya dilakukan di kelas Link.
Posisi dalam mm, orientasi rx, ry, rz dalam derajat.
"""

import argparse
import io
import json
import math
import os
import platform
import re
import subprocess
import sys
import threading
import time
import traceback

import kinematics as M
from virtual_robot import VirtualRobot

R2D, D2R = M.R2D, M.D2R
OUT_LOCK = threading.Lock()
_real_stdout = sys.stdout


def emit(obj):
    s = json.dumps(obj, ensure_ascii=False)
    with OUT_LOCK:
        _real_stdout.write(s + "\n")
        _real_stdout.flush()


def event(name, data):
    emit({"event": name, "data": data})


# ---------------- SDK resmi ----------------
SDK = {"mod": None, "error": None, "dir": None}


def load_sdk(sdk_dir):
    SDK["dir"] = sdk_dir
    try:
        if sdk_dir and os.path.isdir(sdk_dir):
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(sdk_dir)
            sys.path.insert(0, sdk_dir)
        import jkrc  # noqa

        SDK["mod"] = jkrc
    except Exception as e:  # SDK tidak wajib untuk mode virtual
        SDK["error"] = "%s: %s" % (type(e).__name__, e)


class SdkError(RuntimeError):
    pass


def ok(ret, name):
    code = ret[0] if isinstance(ret, (tuple, list)) else ret
    if code != 0:
        raise SdkError("%s gagal (kode %s)" % (name, code))
    return ret


def ping(ip, timeout_ms=1000):
    """Ping ICMP lewat perintah sistem. Mengembalikan (tercapai, waktu_ms, keluaran)."""
    if not re.fullmatch(r"[0-9A-Za-z.\-:]+", ip or ""):
        return False, None, "Alamat IP tidak valid"
    win = platform.system().lower().startswith("win")
    cmd = [
        "ping",
        "-n" if win else "-c",
        "1",
        "-w" if win else "-W",
        str(timeout_ms if win else max(1, timeout_ms // 1000)),
        ip,
    ]
    try:
        flags = 0x08000000 if win else 0  # CREATE_NO_WINDOW
        p = subprocess.run(cmd, capture_output=True, timeout=timeout_ms / 1000 + 3, creationflags=flags)
        out = p.stdout.decode(errors="replace")
        m = re.search(r"(?:time|waktu)[=<]\s*([\d.,]+)\s*ms", out, re.I)
        ms = float(m.group(1).replace(",", ".")) if m else None
        reach = p.returncode == 0 and ("TTL=" in out.upper() or ms is not None)
        return reach, ms, out.strip()[-400:]
    except Exception as e:
        return False, None, str(e)


# ---------------- koneksi robot ----------------
class Link:
    JOINT_MAX = 180.0  # derajat/detik, datasheet JAKA ZU5
    LIN_MAX = 500.0  # mm/detik untuk jog dan gerak linear (batas aplikasi)
    ROT_MAX = 90.0  # derajat/detik untuk jog orientasi

    def __init__(self):
        self.drv = None
        self.mode = None
        self.ip = None
        self.sign = [1] * 6
        self.offset = [0.0] * 6
        self.cap = 30.0  # batas kecepatan aplikasi, persen
        self.lock = threading.RLock()
        self.poll_on = False
        self.last = {}
        self.jog_alive = 0.0  # waktu sinyal terakhir dari tombol jog yang sedang ditahan
        self.jog_cont = False
        self.rec = None  # daftar status saat perekaman program aktif

    # konversi sudut
    def to_ctrl(self, q):
        return [(self.sign[i] * q[i] + self.offset[i]) * D2R for i in range(6)]

    def to_model(self, qr):
        return [(qr[i] * R2D - self.offset[i]) * self.sign[i] for i in range(6)]

    def pct(self, p):
        return max(0.1, min(float(p), self.cap)) / 100.0

    def need(self):
        if not self.drv:
            raise SdkError("Belum tersambung ke robot")

    def call(self, name, *a):
        self.need()
        with self.lock:
            return ok(getattr(self.drv, name)(*a), name)

    # sesi
    def connect(self, mode, ip, sign=None, offset=None, cap=None):
        self.disconnect()
        if sign:
            self.sign = [1 if float(s) >= 0 else -1 for s in sign][:6]
        if offset:
            self.offset = [float(v) for v in offset][:6]
        if cap:
            self.cap = max(1.0, min(100.0, float(cap)))
        if mode == "real":
            if not SDK["mod"]:
                raise SdkError("SDK JAKA (jkrc) tidak dapat dimuat: %s" % SDK["error"])
            if not ip:
                raise SdkError("IP robot kosong")
            drv = SDK["mod"].RC(ip)
        else:
            drv, ip = VirtualRobot(), "virtual"
        ok(drv.login(), "login")
        self.drv, self.mode, self.ip = drv, mode, ip
        self.poll_on = True
        threading.Thread(target=self._poll, daemon=True).start()
        ver = ""
        try:
            ver = str(drv.get_sdk_version()[1])
        except Exception:
            pass
        return {"mode": mode, "ip": ip, "sdk": ver}

    def disconnect(self):
        self.poll_on = False
        if self.drv:
            try:
                with self.lock:
                    self.drv.logout()
            except Exception:
                pass
        self.drv = None
        self.mode = None

    # status
    def read_state(self, full=False):
        self.need()
        with self.lock:
            st = self.drv.get_robot_state()
            qj = self.drv.get_joint_position()
            tcp = self.drv.get_tcp_position()
            inpos = self.drv.is_in_pos()
            mon = self.drv.get_robot_status() if full else None
        s = {"connected": True, "mode": self.mode, "ip": self.ip, "t": time.time()}
        if st[0] == 0:
            e = st[1]
            s["estop"], s["power"], s["enabled"] = bool(e[0]), bool(e[1]), bool(e[2])
        if qj[0] == 0:
            s["q"] = [round(v, 4) for v in self.to_model(qj[1])]
        if tcp[0] == 0:
            p = list(tcp[1])
            s["tcp"] = [round(v, 3) for v in p[:3]] + [round(v * R2D, 3) for v in p[3:6]]
        if inpos[0] == 0:
            s["moving"] = not bool(inpos[1])
        if mon and mon[0] == 0:
            found = find_monitor(mon)
            if found:
                cab, joints = found
                s["joints"] = [{"i": j[0], "v": j[1], "temp": j[2], "tau": j[-1]} for j in joints]
                s["cab"] = cab
        return s

    def _poll(self):
        n = 0
        while self.poll_on and self.drv:
            try:
                rec = self.rec
                self.last = self.read_state(full=(n % 5 == 0) or rec is not None)
                if rec is not None:
                    rec.append(self.last)
                event("state", self.last)
            except Exception as e:
                event("state", {"connected": bool(self.drv), "error": str(e)})
            n += 1
            time.sleep(0.1)
        event("state", {"connected": False})

    # gerak
    def jog(self, kind, axis, direction, step, speed):
        axis = int(axis)
        d = 1 if float(direction) >= 0 else -1
        f = self.pct(speed)
        if kind == "joint":
            d *= self.sign[axis]
            vel = self.JOINT_MAX * f * D2R
            if step:
                return self.call("jog", axis, 1, 1, vel, d * float(step) * D2R)
            self._jog_started()
            return self.call("jog", axis, 2, 1, vel, d)
        vel = (self.LIN_MAX * f) if axis < 3 else (self.ROT_MAX * f * D2R)
        if step:
            amt = float(step) if axis < 3 else float(step) * D2R
            return self.call("jog", axis, 1, 0, vel, d * amt)
        self._jog_started()
        return self.call("jog", axis, 2, 0, vel, d)

    def _jog_started(self):
        self.jog_alive, self.jog_cont = time.time(), True

    def jog_stop(self):
        self.jog_cont = False
        return self.call("jog_stop", -1)

    def watchdog(self):
        """Jog kontinu wajib diperbarui tiap < 0,5 s oleh aplikasi; bila tidak, jog dihentikan."""
        while True:
            time.sleep(0.1)
            if self.jog_cont and self.drv and time.time() - self.jog_alive > 0.5:
                try:
                    self.jog_stop()
                    event(
                        "log",
                        {"stream": "err", "text": "Jog dihentikan otomatis: sinyal tombol hilang (watchdog 0,5 s)"},
                    )
                except Exception:
                    self.jog_cont = False

    def move_j(self, q, speed, block=False):
        lim_check(q)
        vel = self.JOINT_MAX * self.pct(speed) * D2R
        return self.call("joint_move", self.to_ctrl(q), 0, bool(block), vel)

    def move_l(self, pose, speed, block=False):
        vel = self.LIN_MAX * self.pct(speed)
        p = [float(v) for v in pose[:3]] + [float(v) * D2R for v in pose[3:6]]
        return self.call("linear_move", p, 0, bool(block), vel)

    def stop(self):
        """Hentikan gerak dari perangkat lunak. Tombol E-stop fisik tetap pengaman utama."""
        self.need()
        note = []
        with self.lock:
            for name, args in (("motion_abort", ()), ("jog_stop", (-1,))):
                f = getattr(self.drv, name, None)
                if f:
                    try:
                        f(*args)
                        note.append(name)
                    except Exception:
                        pass
        time.sleep(0.3)
        try:
            with self.lock:
                moving = not bool(self.drv.is_in_pos()[1])
            if moving:
                with self.lock:
                    self.drv.disable_robot()
                note.append("disable_robot (gerak masih berjalan)")
        except Exception:
            pass
        return note

    def wait_motion(self, stop_flag, timeout=120):
        t0 = time.time()
        time.sleep(0.15)
        while time.time() - t0 < timeout:
            if stop_flag.is_set():
                raise StopProgram()
            with self.lock:
                r = self.drv.is_in_pos()
            if r[0] == 0 and r[1]:
                return True
            time.sleep(0.05)
        raise SdkError("Gerak tidak selesai dalam %d detik" % timeout)


def lim_check(q):
    for i, v in enumerate(q):
        lo, hi = M.LIMITS[i]
        if not lo <= v <= hi:
            raise SdkError("Sendi %d = %.1f derajat di luar batas %d sampai %d" % (i + 1, v, lo, hi))


def find_monitor(obj):
    """Cari (data_kabinet, data_6_sendi) di struktur get_robot_status (sama dengan 02_rekam_data.py)."""
    num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
    if isinstance(obj, (list, tuple)):
        for i, el in enumerate(obj):
            if (
                isinstance(el, (list, tuple))
                and len(el) == 6
                and all(isinstance(j, (list, tuple)) and 4 <= len(j) <= 5 and all(num(v) for v in j) for j in el)
            ):
                return [v for v in obj[:i] if num(v)], [list(j) for j in el]
            r = find_monitor(el)
            if r:
                return r
    return None


LINK = Link()


# ---------------- program Python pengguna ----------------
class StopProgram(Exception):
    pass


class RobotAPI:
    """Objek `robot` di editor program. Sudut derajat (model), posisi mm, kecepatan persen."""

    def __init__(self, link, stop_flag):
        self._l, self._stop = link, stop_flag

    def _chk(self):
        if self._stop.is_set():
            raise StopProgram()

    @property
    def is_virtual(self):
        return self._l.mode != "real"

    def joints(self):
        self._chk()
        return self._l.to_model(self._l.call("get_joint_position")[1])

    def tcp(self):
        self._chk()
        p = list(self._l.call("get_tcp_position")[1])
        return p[:3] + [v * R2D for v in p[3:6]]

    def move_j(self, q, speed=10):
        self._chk()
        q = [float(v) for v in q]
        print("move_j ->", [round(v, 2) for v in q], "kecepatan %s%%" % speed)
        self._l.move_j(q, speed)
        self._l.wait_motion(self._stop)

    def move_rel_j(self, dq, speed=10):
        q = self.joints()
        self.move_j([a + float(b) for a, b in zip(q, dq)], speed)

    def move_l(self, x, y, z, rx=None, ry=None, rz=None, speed=10):
        self._chk()
        cur = self.tcp()
        pose = [x, y, z, cur[3] if rx is None else rx, cur[4] if ry is None else ry, cur[5] if rz is None else rz]
        print("move_l ->", [round(v, 2) for v in pose], "kecepatan %s%%" % speed)
        self._l.move_l(pose, speed)
        self._l.wait_motion(self._stop)

    def ik(self, x, y, z, rx=None, ry=None, rz=None):
        q = self.joints()
        if rx is None:
            return M.ik_xyz(x, y, z, q)
        return M.ik_pose([x, y, z, rx, ry, rz], q)

    def fk(self, q=None):
        return M.pose_from_T(M.fk(q if q is not None else self.joints())[0])

    def wait(self, seconds):
        t0 = time.time()
        while time.time() - t0 < float(seconds):
            self._chk()
            time.sleep(0.02)

    def set_payload(self, kg, cog_mm=(0, 0, 50)):
        self._chk()
        print("set_payload %.2f kg" % kg)
        return self._l.call("set_payload", float(kg), [float(v) for v in cog_mm])

    def set_do(self, index, value):
        self._chk()
        return self._l.call("set_digital_output", 0, int(index), bool(value))

    def get_di(self, index):
        self._chk()
        return bool(self._l.call("get_digital_input", 0, int(index))[1])

    def status(self):
        self._chk()
        return self._l.read_state(full=True)

    def rec_start(self):
        """Mulai merekam status 10 Hz (sudut, TCP, arus, tegangan, suhu, torsi tiap sendi)."""
        self._l.rec = []

    def rec_stop(self):
        """Hentikan perekaman. Mengembalikan daftar dict dengan kunci t, q, tcp, joints."""
        data, self._l.rec = self._l.rec or [], None
        return data


class NoRobot:
    """Pengganti `robot` saat belum tersambung: bernilai False dan memberi pesan yang jelas."""

    def __bool__(self):
        return False

    def __getattr__(self, name):
        raise SdkError(
            "Belum tersambung: tekan Sambungkan (mode Virtual atau Robot nyata) sebelum memakai robot.%s" % name
        )


class Printer(io.TextIOBase):
    def __init__(self, stream):
        self.stream, self.buf = stream, ""

    def write(self, s):
        self.buf += s
        while "\n" in self.buf:
            line, self.buf = self.buf.split("\n", 1)
            event("log", {"stream": self.stream, "text": line})
        return len(s)

    def flush(self):
        if self.buf:
            event("log", {"stream": self.stream, "text": self.buf})
            self.buf = ""


PROG = {"thread": None, "stop": threading.Event()}


def run_program(code, allow_real):
    if PROG["thread"] and PROG["thread"].is_alive():
        raise SdkError("Program lain masih berjalan")
    need_robot = re.search(r"\brobot\.", code) is not None
    if need_robot and LINK.mode == "real" and not allow_real:
        raise SdkError("Menjalankan program di robot nyata butuh konfirmasi")
    stop = threading.Event()
    PROG["stop"] = stop

    def tracer(frame, why, arg):
        if frame.f_code.co_filename != "program.py":
            return None
        if stop.is_set():
            raise StopProgram()
        return tracer

    def worker():
        out, err = Printer("out"), Printer("err")
        g = {
            "__name__": "__main__",
            "robot": RobotAPI(LINK, stop) if LINK.drv else NoRobot(),
            "model": M,
            "math": math,
            "time": time,
        }
        event("prog", {"status": "running"})
        status = "done"
        sys.settrace(tracer)
        try:
            exec(compile(code, "program.py", "exec"), g)
        except StopProgram:
            status = "stopped"
        except Exception:
            status = "error"
            tb = traceback.format_exc().split("\n")
            keep = [ln for ln in tb if "program.py" in ln or (ln and not ln.startswith(" ") and "Traceback" not in ln)]
            for ln in keep or tb:
                err.write(ln + "\n")
        finally:
            sys.settrace(None)
            LINK.rec = None
            out.flush()
            err.flush()
            if status != "done" and LINK.drv:
                try:
                    LINK.jog_stop()
                except Exception:
                    pass
            event("prog", {"status": status})

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    PROG["thread"] = t
    return {"started": True}


def stop_program():
    PROG["stop"].set()
    note = []
    if LINK.drv:
        try:
            note = LINK.stop()
        except Exception:
            pass
    return {"stopping": True, "note": note}


# ---------------- perintah ----------------
def handle(cmd, a):
    if cmd == "hello":
        return {
            "python": sys.version.split()[0],
            "arch": platform.architecture()[0],
            "sdk": bool(SDK["mod"]),
            "sdk_error": SDK["error"],
            "sdk_dir": SDK["dir"],
            "model_dh": M.DH,
            "limits": M.LIMITS,
        }
    if cmd == "ping":
        reach, ms, out = ping(a.get("ip", ""), int(a.get("timeout", 1000)))
        return {"reachable": reach, "ms": ms, "output": out}
    if cmd == "connect":
        return LINK.connect(a.get("mode", "virtual"), a.get("ip"), a.get("sign"), a.get("offset"), a.get("cap"))
    if cmd == "disconnect":
        stop_program()
        LINK.disconnect()
        return {}
    if cmd == "set_cap":
        LINK.cap = max(1.0, min(100.0, float(a.get("cap", 30))))
        return {"cap": LINK.cap}
    if cmd == "power":
        return LINK.call("power_on" if a.get("on") else "power_off")[0]
    if cmd == "enable":
        return LINK.call("enable_robot" if a.get("on") else "disable_robot")[0]
    if cmd == "state":
        return LINK.read_state(full=True)
    if cmd in ("jog", "move_j", "move_l") and PROG["thread"] and PROG["thread"].is_alive():
        raise SdkError("Program Python sedang berjalan; hentikan dulu sebelum menggerakkan manual")
    if cmd == "jog":
        return LINK.jog(a["kind"], a["axis"], a["dir"], a.get("step"), a.get("speed", 10))[0]
    if cmd == "jog_stop":
        return LINK.jog_stop()[0]
    if cmd == "jog_alive":
        LINK.jog_alive = time.time()
        return 0
    if cmd == "move_j":
        return LINK.move_j([float(v) for v in a["q"]], a.get("speed", 10))[0]
    if cmd == "move_l":
        return LINK.move_l([float(v) for v in a["pose"]], a.get("speed", 10))[0]
    if cmd == "stop":
        return {"note": LINK.stop()}
    if cmd == "kine_forward":
        p = list(LINK.call("kine_forward", LINK.to_ctrl([float(v) for v in a["q"]]))[1])
        return p[:3] + [v * R2D for v in p[3:6]]
    if cmd == "set_payload":
        return LINK.call("set_payload", float(a.get("kg", 0)), [float(v) for v in a.get("cog", [0, 0, 50])])[0]
    if cmd == "run":
        return run_program(a.get("code", ""), bool(a.get("allow_real")))
    if cmd == "stop_program":
        return stop_program()
    raise SdkError("Perintah tidak dikenal: %s" % cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sdk", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "sdk"))
    args = ap.parse_args()
    load_sdk(args.sdk)
    sys.stdout = Printer("out")  # print liar tidak boleh merusak protokol
    event("ready", handle("hello", {}))
    threading.Thread(target=LINK.watchdog, daemon=True).start()
    import queue

    q = queue.Queue()

    def serial():
        # perintah robot diproses berurutan supaya jog_stop tidak pernah menyalip jog
        while True:
            m = q.get()
            if m is None:
                return
            run_one(m)

    threading.Thread(target=serial, daemon=True).start()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        if msg.get("cmd") in ("ping", "hello"):
            # ping bisa lambat dan tidak menyentuh robot, jadi berjalan sendiri
            threading.Thread(target=run_one, args=(msg,), daemon=True).start()
        else:
            q.put(msg)
    # aplikasi tertutup (stdin habis): hentikan gerak dulu, lalu logout
    PROG["stop"].set()
    if LINK.drv:
        try:
            LINK.stop()
        except Exception:
            pass
    LINK.disconnect()


def run_one(m):
    try:
        emit({"id": m.get("id"), "ok": True, "data": handle(m.get("cmd"), m.get("args") or {})})
    except Exception as e:
        emit({"id": m.get("id"), "ok": False, "error": str(e) or type(e).__name__})


if __name__ == "__main__":
    main()
