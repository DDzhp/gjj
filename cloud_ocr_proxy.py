#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cloud_ocr_proxy.py — 工具集网页版「云 OCR / 云二维码」本地代理（零第三方依赖）

功能：
  GET  /ping        健康检查 -> {"ok": true, "engine": "cloud"}
  POST /ocr         图片 -> 百度通用文字识别(general_basic + detect_direction 自动纠偏) -> {"text": "..."}
  POST /qr          图片 -> 腾讯云 QrcodeOCR(TC3-HMAC-SHA256 签名) -> {"codes": [{"data","x","y","w","h"}]}

用途：
  网页版(二维码批量识别)选择「云」引擎时，浏览器只与本代理通信(localhost:8765)，
  云密钥保存在本机 config.json / 环境变量，不进入浏览器，天然绕开 CORS 与密钥泄漏。

密钥配置（优先级：环境变量 > config.json）：
  BAIDU_API_KEY / BAIDU_SECRET_KEY       百度智能云（https://console.bce.baidu.com/ai/#/ai/ocr/app/list）
  TENCENT_SECRET_ID / TENCENT_SECRET_KEY 腾讯云 CAM 密钥（https://console.cloud.tencent.com/cam/capi）

config.json（与本脚本同目录）示例：
  {
    "baidu_api_key": "...",
    "baidu_secret_key": "...",
    "tencent_secret_id": "...",
    "tencent_secret_key": "..."
  }

启动：
  python cloud_ocr_proxy.py            # 默认 http://127.0.0.1:8765
  python cloud_ocr_proxy.py --port 9000
"""

import sys
import os
import io
import json
import time
import base64
import hashlib
import hmac
import re
import argparse
import threading
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---- Windows 控制台 UTF-8 输出（避免 GBK 打印中文崩溃）----
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")

BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
BAIDU_OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic"
BAIDU_QR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/qrcode"
TENCENT_OCR_HOST = "ocr.tencentcloudapi.com"
TENCENT_ACTION = "QrcodeOCR"
TENCENT_VERSION = "2018-11-19"
TENCENT_REGION = "ap-guangzhou"

HTTP_TIMEOUT = 60
MAX_BODY = 16 * 1024 * 1024  # 16MB 上传上限


# ---------------------------------------------------------------- 密钥配置
def load_config():
    cfg = {}
    if os.path.exists(CONFIG_PATH):
        try:
            with io.open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f) or {}
        except Exception as e:
            print("[warn] config.json 读取失败: %s" % e)
    return cfg


def get_secret(key_env, key_file, cfg):
    v = os.environ.get(key_env)
    if v:
        return v.strip()
    v = cfg.get(key_file)
    if v:
        return str(v).strip()
    return ""


_CFG = None


def secrets():
    global _CFG
    if _CFG is None:
        _CFG = load_config()
    return {
        "baidu_ak": get_secret("BAIDU_API_KEY", "baidu_api_key", _CFG),
        "baidu_sk": get_secret("BAIDU_SECRET_KEY", "baidu_secret_key", _CFG),
        "tencent_id": get_secret("TENCENT_SECRET_ID", "tencent_secret_id", _CFG),
        "tencent_key": get_secret("TENCENT_SECRET_KEY", "tencent_secret_key", _CFG),
    }


# ---------------------------------------------------------------- multipart 解析
def parse_multipart(body, content_type):
    """极简 multipart/form-data 解析：返回 [(name, filename, bytes)]"""
    m = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type or "")
    boundary = (m.group(1) or m.group(2) or "").strip() if m else ""
    if not boundary:
        return []
    sep = ("--" + boundary).encode("utf-8")
    parts = body.split(sep)
    out = []
    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        header_block, content = part.split(b"\r\n\r\n", 1)
        headers = {}
        for line in header_block.split(b"\r\n"):
            if b":" in line:
                k, v = line.split(b":", 1)
                headers[k.strip().lower()] = v.strip()
        cd = headers.get("content-disposition", b"").decode("utf-8", "ignore")
        m2 = re.search(r'name="([^"]*)"', cd)
        m3 = re.search(r'filename="([^"]*)"', cd)
        out.append((m2.group(1) if m2 else None,
                    m3.group(1) if m3 else None,
                    content))
    return out


def read_image_bytes(self):
    """从 POST 请求提取图片二进制"""
    length = int(self.headers.get("Content-Length") or 0)
    if length <= 0 or length > MAX_BODY:
        return None
    body = self.rfile.read(length)
    ctype = self.headers.get("Content-Type") or ""
    if ctype.startswith("multipart/"):
        parts = parse_multipart(body, ctype)
        for name, filename, data in parts:
            if data:
                return data
        return None
    # 兼容直接 body = base64
    try:
        return base64.b64decode(body)
    except Exception:
        return body


# ---------------------------------------------------------------- 百度 OCR
_token_cache = {"token": None, "expire": 0}
_token_lock = threading.Lock()


def baidu_access_token(s):
    global _token_cache
    with _token_lock:
        if _token_cache["token"] and time.time() < _token_cache["expire"] - 300:
            return _token_cache["token"]
        url = BAIDU_TOKEN_URL + "?" + urllib.parse.urlencode({
            "grant_type": "client_credentials",
            "client_id": s["baidu_ak"],
            "client_secret": s["baidu_sk"],
        })
        with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if "access_token" not in data:
            raise RuntimeError("百度 token 获取失败: %s" % data.get("error_description") or data)
        _token_cache = {
            "token": data["access_token"],
            "expire": time.time() + int(data.get("expires_in", 2592000)),
        }
        return _token_cache["token"]


def baidu_ocr(img_bytes, s):
    if not s["baidu_ak"] or not s["baidu_sk"]:
        raise RuntimeError("百度密钥未配置：请在 config.json 填写 baidu_api_key / baidu_secret_key，或设置环境变量 BAIDU_API_KEY / BAIDU_SECRET_KEY")
    token = baidu_access_token(s)
    b64 = base64.b64encode(img_bytes).decode("ascii")
    payload = urllib.parse.urlencode({
        "image": b64,
        "detect_direction": "true",   # 自动纠偏旋转，解决 PCB 竖排 IMEI
    }).encode("utf-8")
    req = urllib.request.Request(
        BAIDU_OCR_URL + "?access_token=" + urllib.parse.quote(token),
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if "words_result" not in data:
        err = data.get("error_msg") or data.get("error") or str(data)
        raise RuntimeError("百度 OCR 识别失败: %s" % err)
    words = [w.get("words", "") for w in (data.get("words_result") or [])]
    return "\n".join([w for w in words if w])


# ---------------------------------------------------------------- 百度二维码识别
def baidu_qrcode(img_bytes, s):
    """百度智能云「二维码识别」:https://aip.baidubce.com/rest/2.0/ocr/v1/qrcode
    免费额度 500 次/月（共享资源包），可识别二维码/条形码（含 PDF417 等）。
    响应: { codes_result: [ { text: [..], location: { top_left, top_right, bottom_left, bottom_right } } ] }"""
    if not s["baidu_ak"] or not s["baidu_sk"]:
        raise RuntimeError("百度密钥未配置：请在 config.json 填写 baidu_api_key / baidu_secret_key，或设置环境变量 BAIDU_API_KEY / BAIDU_SECRET_KEY")
    token = baidu_access_token(s)
    b64 = base64.b64encode(img_bytes).decode("ascii")
    payload = urllib.parse.urlencode({"image": b64}).encode("utf-8")
    req = urllib.request.Request(
        BAIDU_QR_URL + "?access_token=" + urllib.parse.quote(token),
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if "codes_result" not in data:
        err = data.get("error_msg") or data.get("error") or str(data)
        raise RuntimeError("百度二维码识别失败: %s" % err)
    codes = []
    for cr in (data.get("codes_result") or []):
        loc = cr.get("location") or {}
        try:
            xs = [loc.get(k, {}).get("x", 0) for k in ("top_left", "top_right", "bottom_left", "bottom_right")]
            ys = [loc.get(k, {}).get("y", 0) for k in ("top_left", "top_right", "bottom_left", "bottom_right")]
            minx, maxx = min(xs), max(xs)
            miny, maxy = min(ys), max(ys)
            x, y = minx, miny
            w, h = maxx - minx, maxy - miny
        except Exception:
            x, y, w, h = 0, 0, 0, 0
        # 一个码可能返回多个 text（条形码等多结果），拆成独立 entry
        texts = cr.get("text")
        if isinstance(texts, str):
            texts = [texts]
        elif not texts:
            texts = [""]
        for t in texts:
            if t:
                codes.append({
                    "data": t,
                    "x": max(0, int(x)),
                    "y": max(0, int(y)),
                    "w": max(10, int(w)),
                    "h": max(10, int(h)),
                })
    return codes


# ---------------------------------------------------------------- 腾讯云 OCR 系列（QrcodeOCR / GeneralBasicOCR 等统一封装）
def tc3_sign(payload_str, s, timestamp, date, action):
    """腾讯云 TC3-HMAC-SHA256 签名（action 由调用方传入：QrcodeOCR / GeneralBasicOCR 等）"""
    service = "ocr"
    host = TENCENT_OCR_HOST
    ct = "application/json; charset=utf-8"
    canonical_uri = "/"
    canonical_querystring = ""
    hashed_payload = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
    canonical_headers = "content-type:%s\nhost:%s\nx-tc-action:%s\n" % (ct, host, action.lower())
    signed_headers = "content-type;host;x-tc-action"
    canonical_request = "\n".join([
        "POST", canonical_uri, canonical_querystring,
        canonical_headers, signed_headers, hashed_payload,
    ])
    credential_scope = "%s/%s/tc3_request" % (date, service)
    hashed_canonical = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = "\n".join([
        "TC3-HMAC-SHA256", str(timestamp), credential_scope, hashed_canonical,
    ])

    def _hmac(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac(("TC3" + s["tencent_key"]).encode("utf-8"), date)
    secret_service = _hmac(secret_date, service)
    secret_signing = _hmac(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return ("TC3-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
            % (s["tencent_id"], credential_scope, signed_headers, signature))


def _tc3_call(s, action, body):
    """腾讯云 OCR 系列统一请求封装：自动处理签名+时间戳+响应解析"""
    if not s["tencent_id"] or not s["tencent_key"]:
        raise RuntimeError("腾讯密钥未配置：请在 config.json 填写 tencent_secret_id / tencent_secret_key，或设置环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY")
    timestamp = int(time.time())
    date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
    payload_str = json.dumps(body, ensure_ascii=False)
    authorization = tc3_sign(payload_str, s, timestamp, date, action)
    headers = {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": TENCENT_OCR_HOST,
        "X-TC-Action": action,
        "X-TC-Version": TENCENT_VERSION,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Region": TENCENT_REGION,
    }
    req = urllib.request.Request(
        "https://" + TENCENT_OCR_HOST + "/",
        data=payload_str.encode("utf-8"),
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tencent_qrcode(img_bytes, s):
    """腾讯云 QrcodeOCR（Action=QrcodeOCR，免费 1000 次/月）
    响应 CodeResults[].Url=二维码内容, TypeName='QR_CODE', Position={LeftTop/RightTop/LeftBottom/RightBottom:{X,Y}}"""
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data = _tc3_call(s, TENCENT_ACTION, {"ImageBase64": b64})
    resp_body = data.get("Response") or {}
    if "Error" in resp_body:
        e = resp_body["Error"]
        raise RuntimeError("腾讯云二维码错误[%s]: %s" % (e.get("Code"), e.get("Message")))
    if resp_body.get("TaskStatus") not in ("SUCCESS", None):
        raise RuntimeError("腾讯云二维码识别失败: %s" % resp_body.get("TaskStatus"))
    codes = []
    for cr in (resp_body.get("CodeResults") or []):
        # 内容字段：官方为 Url（兼容 Data 旧命名）
        content = cr.get("Url") or cr.get("Data") or ""
        # 位置：Position 四个角点对象（兼容 Quadrangle 数组旧命名）
        pos = cr.get("Position") or {}
        pts = [pos.get(k) for k in ("LeftTop", "RightTop", "LeftBottom", "RightBottom")]
        pts = [p for p in pts if isinstance(p, dict) and "X" in p and "Y" in p]
        if not pts:
            quad = cr.get("Quadrangle") or []
            pts = [p for p in quad if isinstance(p, dict) and "X" in p and "Y" in p]
        if pts:
            xs = [p["X"] for p in pts]
            ys = [p["Y"] for p in pts]
            x, w = min(xs), max(xs) - min(xs)
            y, h = min(ys), max(ys) - min(ys)
        else:
            x, y, w, h = 0, 0, 0, 0
        codes.append({
            "data": content,
            "x": max(0, int(x)),
            "y": max(0, int(y)),
            "w": max(10, int(w)),
            "h": max(10, int(h)),
        })
    return codes


def tencent_ocr(img_bytes, s):
    """腾讯云 GeneralBasicOCR（Action=GeneralBasicOCR，免费 1000 次/月；与二维码共享密钥不同 Action）"""
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data = _tc3_call(s, "GeneralBasicOCR", {"ImageBase64": b64, "LanguageType": "auto"})
    resp_body = data.get("Response") or {}
    if "Error" in resp_body:
        e = resp_body["Error"]
        raise RuntimeError("腾讯云 OCR 错误[%s]: %s" % (e.get("Code"), e.get("Message")))
    texts = [t.get("DetectedText", "") for t in (resp_body.get("TextDetections") or [])]
    return "\n".join([t for t in texts if t])


# ---------------------------------------------------------------- HTTP 处理
def json_response(handler, obj, status=200):
    body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Private-Network", "true")  # Chrome/Edge PNA：允许 https 线上页访问本机代理
    handler.end_headers()
    handler.wfile.write(body)


class ProxyHandler(BaseHTTPRequestHandler):
    server_version = "CloudOCRProxy/1.0"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (time.strftime("%H:%M:%S"), fmt % args), flush=True)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")  # PNA 预检放行
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/ping":
            json_response(self, {"ok": True, "engine": "cloud", "time": time.strftime("%Y-%m-%d %H:%M:%S")})
        else:
            json_response(self, {"error": "not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        img = read_image_bytes(self)
        if img is None:
            json_response(self, {"error": "未读取到图片数据（Content-Length 非法或超过 %dMB）" % (MAX_BODY // 1024 // 1024)}, 400)
            return
        s = secrets()
        try:
            if path == "/ocr":
                text = baidu_ocr(img, s)
                json_response(self, {"text": text})
            elif path == "/ocr_tencent":
                text = tencent_ocr(img, s)
                json_response(self, {"text": text})
            elif path == "/qr":
                codes = tencent_qrcode(img, s)
                json_response(self, {"codes": codes})
            elif path == "/qr_baidu":
                codes = baidu_qrcode(img, s)
                json_response(self, {"codes": codes})
            else:
                json_response(self, {"error": "not found"}, 404)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "ignore")[:500]
            json_response(self, {"error": "云接口 HTTP %s: %s" % (e.code, detail)}, 502)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)


def main():
    ap = argparse.ArgumentParser(description="工具集云 OCR / 云二维码本地代理（零依赖）")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    s = secrets()
    if not s["baidu_ak"] or not s["tencent_id"]:
        print("[warn] 密钥未配置完整：百度=%s 腾讯=%s" % (
            "已配置" if s["baidu_ak"] else "未配置",
            "已配置" if s["tencent_id"] else "未配置",
        ))
        print("      可编辑 %s 或设置环境变量（详见文件头注释）" % CONFIG_PATH)

    server = ThreadingHTTPServer((args.host, args.port), ProxyHandler)
    print("=" * 56)
    print(" Cloud OCR Proxy running on http://%s:%d" % (args.host, args.port))
    print("   /ping          健康检查")
    print("   /ocr           百度 OCR   (general_basic + detect_direction 自动纠偏)")
    print("   /ocr_tencent   腾讯云 OCR (GeneralBasicOCR)")
    print("   /qr            腾讯云二维码 (QrcodeOCR)")
    print("   /qr_baidu      百度云二维码 (v1/qrcode)")
    print(" 按 Ctrl+C 停止。保持本窗口开启，网页版才能使用云引擎。")
    print("=" * 56, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()


if __name__ == "__main__":
    main()
