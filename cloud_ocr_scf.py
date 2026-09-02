#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cloud_ocr_scf.py — 工具集网页版「云 OCR / 云二维码」腾讯云 SCF 云函数版（零第三方依赖）

与 cloud_ocr_proxy.py / cloud_ocr_worker.mjs / cloud_ocr_edgeone.mjs 端点完全一致，可无缝切换：
  GET  /ping        健康检查 -> {"ok": true, "engine": "scf"}
  POST /ocr         图片 -> 百度通用文字识别(general_basic + detect_direction 自动纠偏) -> {"text": "..."}
  POST /ocr_numbers 图片 -> 百度数字识别(v1/numbers，仅返回数字，免费 200 次/天) -> {"text": "..."}
  POST /ocr_tencent 图片 -> 腾讯云 GeneralBasicOCR -> {"text": "..."}
  POST /qr          图片 -> 腾讯云 QrcodeOCR(TC3-HMAC-SHA256 签名) -> {"codes": [{"data","x","y","w","h"}]}
  POST /qr_baidu    图片 -> 百度云二维码(v1/qrcode) -> {"codes": [...]}

为什么用 SCF 而不是 EdgeOne 边缘函数：
  EdgeOne 需要：建站点 -> 加加速域名 -> CNAME -> 配 HTTPS 证书 -> 触发规则(且规则需 HOST 条件+自定义域名，
  各种 522/545/大陆默认域名 attachment 限制) —— 链路长坑多。
  SCF「函数 URL」是云函数自带的公网 HTTP(S) 端点，创建即用，免站点/域名/证书/触发规则，浏览器可直接访问。

部署（一次性，约 10 分钟）：
  1. 腾讯云控制台 -> 搜「云函数」SCF -> 函数服务 -> 新建 -> 创建方式「空白函数」
     函数类型「事件函数」、运行环境「Python 3.9」（或 3.6/3.7/3.10）、地域随意(推荐 ap-guangzhou)
  2. 执行方法填 index.main_handler；把本文件全部内容粘贴进 index.py 在线编辑器 -> 点「部署」
  3. 函数配置 -> 「超时时间」改为 60 秒（默认 3 秒不够 OCR 大图）
  4. 函数配置 -> 「环境变量」添加 4 个密钥：
        BAIDU_API_KEY / BAIDU_SECRET_KEY       百度智能云
        TENCENT_SECRET_ID / TENCENT_SECRET_KEY 腾讯云 CAM
  5. 「触发管理」-> 创建触发器 -> 触发器类型「函数 URL」-> 访问方式「公开（无需鉴权）」-> 提交
  6. 复制得到的 URL（形如 https://xxx.ap-guangzhou.app.tcloudbase.com/ 或 *.tencentscf.com）
  7. 验证：浏览器打开 <URL>/ping -> {"ok":true,"engine":"scf",...}
  8. 网页版「云端代理地址」填 <URL>（不带尾部斜杠）-> 保存 -> 测试连接

本函数无任何第三方依赖，全部用 Python 标准库（urllib/hashlib/hmac/base64/re/json）。
"""

import os
import io
import json
import time
import base64
import hashlib
import hmac
import re
import urllib.request
import urllib.parse
import urllib.error

# 运行时若在本地直接跑也能当普通函数调试（不推荐，仅辅助）
BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
BAIDU_OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic"
BAIDU_NUMBERS_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/numbers"
BAIDU_QR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/qrcode"
TENCENT_OCR_HOST = "ocr.tencentcloudapi.com"
TENCENT_VERSION = "2018-11-19"
TENCENT_REGION = "ap-guangzhou"

HTTP_TIMEOUT = 55  # 留余量给 SCF 超时时间(建议函数配置 60s)

_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
}


# ---------------------------------------------------------------- 密钥配置（SCF 环境变量优先）
def _env(name):
    try:
        v = os.environ.get(name)
        return (v or "").strip()
    except Exception:
        return ""


def secrets():
    return {
        "baidu_ak": _env("BAIDU_API_KEY"),
        "baidu_sk": _env("BAIDU_SECRET_KEY"),
        "tencent_id": _env("TENCENT_SECRET_ID"),
        "tencent_key": _env("TENCENT_SECRET_KEY"),
    }


# ---------------------------------------------------------------- 入站请求解析
def parse_multipart(body, content_type):
    """极简 multipart/form-data 解析：返回 [(name, filename, bytes)]（与 cloud_ocr_proxy.py 一致）"""
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


_IMG_MAGIC = (b"\xff\xd8\xff", b"\x89PNG", b"GIF89a", b"GIF87a", b"BM", b"II*\x00", b"MM\x00*")


def _looks_image(bs):
    """用文件魔数判断 bytes 是否像有效图片（避免把损坏/文本当图上传）"""
    if not bs or len(bs) < 24:
        return False
    return bs.startswith(_IMG_MAGIC)


def extract_image_bytes(event):
    """从 SCF 函数 URL / API 网关事件里提取图片二进制，对平台各种 body 形态都无损。
    平台差异：isBase64Encoded=True 给 base64 文本；或把原始字节按 latin-1 一对一映射成 str
    （此时 utf-8 重编码会损坏图片！必须用 latin-1 还原）；也可能是原始 bytes / 裸 base64。"""
    headers = {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}
    raw_ctype = headers.get("content-type") or ""
    ctype_l = raw_ctype.lower()  # 只小写用于判断；boundary 大小写敏感，解析时必须用原始值
    body = event.get("body") or ""

    def _try_multipart(bs):
        parts = parse_multipart(bs, raw_ctype)
        for _name, _filename, data in parts:
            if data and _looks_image(data):
                return data
        for _name, _filename, data in parts:  # 宽松兜底：第一个非空字段
            if data:
                return data
        return None

    candidates = []
    if isinstance(body, (bytes, bytearray)):
        candidates.append(bytes(body))
    elif isinstance(body, str):
        if event.get("isBase64Encoded"):
            candidates.append(base64.b64decode(re.sub(r"\s+", "", body)))
        else:
            # ① 平台按 latin-1 保字节（二进制 multipart 的标准传递方式，无损）
            candidates.append(body.encode("latin-1", "ignore"))
            # ② 纯文本/JSON 等 utf-8 形态（仅文本输入场景）
            u = body.encode("utf-8", "ignore")
            if u != candidates[-1]:
                candidates.append(u)
            # ③ 网关没标 isBase64Encoded 却给了 base64 文本
            s = re.sub(r"\s+", "", body)
            if s and len(s) % 4 == 0:
                try:
                    candidates.append(base64.b64decode(s))
                except Exception:
                    pass

    for c in candidates:
        if not c:
            continue
        if ctype_l.startswith("multipart/"):
            out = _try_multipart(c)
            if out:
                return out
        else:
            if _looks_image(c):  # 原始字节
                return c
            try:  # 裸 base64 文本
                d = base64.b64decode(re.sub(rb"\s+", b"", c))
                if _looks_image(d):
                    return d
            except Exception:
                pass
    return None


# ---------------------------------------------------------------- 百度 OCR（与 cloud_ocr_proxy.py 逻辑一致）
_token_cache = {"token": None, "expire": 0}


def baidu_access_token(s):
    global _token_cache
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
    _token_cache = {"token": data["access_token"],
                    "expire": time.time() + int(data.get("expires_in", 2592000))}
    return _token_cache["token"]


def _baidu_post(s, api_url, img_bytes, extra=None):
    if not s["baidu_ak"] or not s["baidu_sk"]:
        raise RuntimeError("百度密钥未配置：请在 SCF 环境变量设置 BAIDU_API_KEY / BAIDU_SECRET_KEY")
    token = baidu_access_token(s)
    b64 = base64.b64encode(img_bytes).decode("ascii")
    payload = {"image": b64}
    if extra:
        payload.update(extra)
    req = urllib.request.Request(
        api_url + "?access_token=" + urllib.parse.quote(token),
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def baidu_ocr(img_bytes, s):
    data = _baidu_post(s, BAIDU_OCR_URL, img_bytes, {"detect_direction": "true"})
    if "words_result" not in data:
        raise RuntimeError("百度 OCR 识别失败: %s" % (data.get("error_msg") or data.get("error") or data))
    return "\n".join([w.get("words", "") for w in data.get("words_result") or [] if w.get("words")])


def baidu_ocr_numbers(img_bytes, s):
    data = _baidu_post(s, BAIDU_NUMBERS_URL, img_bytes, {"detect_direction": "true"})
    if "words_result" not in data:
        raise RuntimeError("百度数字识别失败: %s" % (data.get("error_msg") or data.get("error") or data))
    return "\n".join([w.get("words", "") for w in data.get("words_result") or [] if w.get("words")])


def baidu_qrcode(img_bytes, s):
    data = _baidu_post(s, BAIDU_QR_URL, img_bytes, None)
    if "codes_result" not in data:
        raise RuntimeError("百度二维码识别失败: %s" % (data.get("error_msg") or data.get("error") or data))
    codes = []
    for cr in (data.get("codes_result") or []):
        loc = cr.get("location") or {}
        try:
            keys = ("top_left", "top_right", "bottom_left", "bottom_right")
            xs = [loc.get(k, {}).get("x", 0) for k in keys]
            ys = [loc.get(k, {}).get("y", 0) for k in keys]
            x, y = min(xs), min(ys)
            w, h = max(xs) - x, max(ys) - y
        except Exception:
            x, y, w, h = 0, 0, 0, 0
        texts = cr.get("text")
        if isinstance(texts, str):
            texts = [texts]
        elif not texts:
            texts = [""]
        for t in texts:
            if t:
                codes.append({"data": t,
                              "x": max(0, int(x)), "y": max(0, int(y)),
                              "w": max(10, int(w)), "h": max(10, int(h))})
    return codes


# ---------------------------------------------------------------- 腾讯云 TC3 签名（与 cloud_ocr_proxy.py 一致）
def tc3_sign(payload_str, s, timestamp, date, action):
    service = "ocr"
    host = TENCENT_OCR_HOST
    ct = "application/json; charset=utf-8"
    canonical_headers = "content-type:%s\nhost:%s\nx-tc-action:%s\n" % (ct, host, action.lower())
    signed_headers = "content-type;host;x-tc-action"
    hashed_payload = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
    canonical_request = "\n".join(["POST", "/", "", canonical_headers, signed_headers, hashed_payload])
    credential_scope = "%s/%s/tc3_request" % (date, service)
    string_to_sign = "\n".join(["TC3-HMAC-SHA256", str(timestamp), credential_scope,
                                hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()])

    def _hmac(key, msg):
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac(("TC3" + s["tencent_key"]).encode("utf-8"), date)
    secret_service = _hmac(secret_date, service)
    secret_signing = _hmac(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return ("TC3-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
            % (s["tencent_id"], credential_scope, signed_headers, signature))


def _tc3_call(s, action, body):
    if not s["tencent_id"] or not s["tencent_key"]:
        raise RuntimeError("腾讯密钥未配置：请在 SCF 环境变量设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY")
    timestamp = int(time.time())
    date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
    payload_str = json.dumps(body, ensure_ascii=False)
    headers = {
        "Authorization": tc3_sign(payload_str, s, timestamp, date, action),
        "Content-Type": "application/json; charset=utf-8",
        "Host": TENCENT_OCR_HOST,
        "X-TC-Action": action,
        "X-TC-Version": TENCENT_VERSION,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Region": TENCENT_REGION,
    }
    req = urllib.request.Request("https://" + TENCENT_OCR_HOST + "/",
                                 data=payload_str.encode("utf-8"), headers=headers)
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tencent_qrcode(img_bytes, s):
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data = _tc3_call(s, "QrcodeOCR", {"ImageBase64": b64})
    rb = data.get("Response") or {}
    if "Error" in rb:
        raise RuntimeError("腾讯云二维码错误[%s]: %s" % (rb["Error"].get("Code"), rb["Error"].get("Message")))
    codes = []
    for cr in (rb.get("CodeResults") or []):
        content = cr.get("Url") or cr.get("Data") or ""
        pos = cr.get("Position") or {}
        pts = [pos.get(k) for k in ("LeftTop", "RightTop", "LeftBottom", "RightBottom")]
        pts = [p for p in pts if isinstance(p, dict) and "X" in p and "Y" in p]
        if not pts:
            quad = cr.get("Quadrangle") or []
            pts = [p for p in quad if isinstance(p, dict) and "X" in p and "Y" in p]
        if pts:
            xs = [p["X"] for p in pts]
            ys = [p["Y"] for p in pts]
            x, y, w, h = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
        else:
            x, y, w, h = 0, 0, 0, 0
        codes.append({"data": content,
                      "x": max(0, int(x)), "y": max(0, int(y)),
                      "w": max(10, int(w)), "h": max(10, int(h))})
    return codes


def tencent_ocr(img_bytes, s):
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data = _tc3_call(s, "GeneralBasicOCR", {"ImageBase64": b64, "LanguageType": "auto"})
    rb = data.get("Response") or {}
    if "Error" in rb:
        raise RuntimeError("腾讯云 OCR 错误[%s]: %s" % (rb["Error"].get("Code"), rb["Error"].get("Message")))
    return "\n".join([t.get("DetectedText", "") for t in rb.get("TextDetections") or [] if t.get("DetectedText")])


# ---------------------------------------------------------------- SCF 入口
def _json_response(obj, status=200, extra_headers=None):
    body = json.dumps(obj, ensure_ascii=False)
    headers = dict(_CORS)
    headers["Content-Type"] = "application/json; charset=utf-8"
    if extra_headers:
        headers.update(extra_headers)
    return {"isBase64Encoded": False, "statusCode": status, "headers": headers, "body": body}


def main_handler(event, context):
    """腾讯云 SCF 函数 URL / API 网关统一入口"""
    if not event:
        event = {}
    method = (event.get("httpMethod") or event.get("method") or "GET").upper()
    headers = {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}
    # 函数 URL 的 path 在 path 字段；API 网关带 /release 前缀时去掉
    path = event.get("path") or event.get("pathParameters") or "/"
    # 兼容 path 形如 /release/ping 或 /ping
    segs = path.rstrip("/").split("/")
    if segs and segs[-1] in ("ping", "ocr", "ocr_numbers", "ocr_tencent", "qr", "qr_baidu"):
        path = "/" + segs[-1]
    else:
        # 取最后一个以 / 开头的合法片段兜底
        for i in range(len(segs) - 1, -1, -1):
            if segs[i] in ("ping", "ocr", "ocr_numbers", "ocr_tencent", "qr", "qr_baidu"):
                path = "/" + segs[i]
                break

    # OPTIONS 预检
    if method == "OPTIONS":
        return {"isBase64Encoded": False, "statusCode": 204, "headers": dict(_CORS), "body": ""}

    if method == "GET" and path == "/ping":
        return _json_response({
            "ok": True,
            "engine": "scf",
            "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        })

    if method != "POST":
        return _json_response({"error": "method not allowed"}, 405)

    try:
        img = extract_image_bytes(event)
        if img is None or not img:
            return _json_response({"error": "未读取到图片数据（multipart/form-data 或原始字节）"}, 400)
        s = secrets()
        if path == "/ocr":
            return _json_response({"text": baidu_ocr(img, s)})
        if path == "/ocr_numbers":
            return _json_response({"text": baidu_ocr_numbers(img, s)})
        if path == "/ocr_tencent":
            return _json_response({"text": tencent_ocr(img, s)})
        if path == "/qr":
            return _json_response({"codes": tencent_qrcode(img, s)})
        if path == "/qr_baidu":
            return _json_response({"codes": baidu_qrcode(img, s)})
        return _json_response({"error": "not found: " + path}, 404)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:500]
        return _json_response({"error": "云接口 HTTP %s: %s" % (e.code, detail)}, 502)
    except Exception as e:
        return _json_response({"error": str(e)}, 500)


if __name__ == "__main__":
    # 本地冒烟测试（可选）：
    # python cloud_ocr_scf.py ping
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "ping":
        r = main_handler({"httpMethod": "GET", "path": "/ping", "headers": {}}, None)
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print("本文件是腾讯云 SCF 云函数入口，请部署到 SCF 后通过函数 URL 访问。")
        print("本地冒烟：python cloud_ocr_scf.py ping")
