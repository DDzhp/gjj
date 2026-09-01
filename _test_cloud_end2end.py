# -*- coding: utf-8 -*-
"""同进程启动代理+测试4端点+关闭（避免沙箱回收后台进程）"""
import sys, os, io, threading, urllib.request, urllib.error, json, base64, time
sys.path.insert(0, r'F:\ylgongzuo\对接文档\11-模板\工作\工具集')
import importlib.util
spec = importlib.util.spec_from_file_location('proxy_mod', r'F:\ylgongzuo\对接文档\11-模板\工作\工具集\cloud_ocr_proxy.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

PORT = 18765
server = m.ThreadingHTTPServer(('127.0.0.1', PORT), m.ProxyHandler)
th = threading.Thread(target=server.serve_forever, daemon=True)
th.start()
time.sleep(0.5)

def post(path, img_bytes, timeout=90):
    boundary = '----WB'
    body = io.BytesIO()
    body.write(('--%s\r\n' % boundary).encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="t.jpg"\r\nContent-Type: image/jpeg\r\n\r\n')
    body.write(img_bytes)
    body.write(('\r\n--%s--\r\n' % boundary).encode())
    req = urllib.request.Request('http://127.0.0.1:%d%s' % (PORT, path), data=body.getvalue(),
        headers={'Content-Type': 'multipart/form-data; boundary=%s' % boundary})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode('utf-8', 'ignore'))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode('utf-8', 'ignore'))
        except Exception:
            body = e.read().decode('utf-8', 'ignore')[:200]
        return e.code, body

# 缩图
try:
    from PIL import Image
    src = r'C:/Users/60969/Desktop/二维码/22/微信图片_20260826132257_232_388.jpg'
    im = Image.open(src)
    im.thumbnail((1500, 1500))
    buf = io.BytesIO(); im.convert('RGB').save(buf, 'JPEG', quality=85)
    img = buf.getvalue()
except ImportError:
    img = open(r'C:/Users/60969/Desktop/二维码/22/微信图片_20260826132257_232_388.jpg','rb').read()
print('图大小：', len(img), 'bytes (base64后', len(base64.b64encode(img)), ')')

for ep in ['/ocr', '/ocr_tencent', '/qr', '/qr_baidu']:
    t0 = time.time()
    code, data = post(ep, img, timeout=90)
    dt = time.time() - t0
    print('--- POST', ep, '->', code, '(%5.1fs)' % dt)
    if 'codes' in data:
        print('  codes:', len(data['codes']))
        for i, c in enumerate(data['codes'][:5]):
            d = c['data']
            print('   [%d] x=%d y=%d w=%d h=%d data=%r' % (i+1, c['x'], c['y'], c['w'], c['h'], d[:60]))
    elif 'text' in data:
        t = data['text']
        print('  text_len:', len(t))
        print('  首段:', t[:200].replace(chr(10), ' | '))
        imeis = []
        import re
        for m in re.finditer(r'\d{15}|\d{13,17}', t):
            imeis.append(m.group(0))
        if imeis:
            print('  ★ IMEI 候选:', imeis[:5])
    elif 'error' in data:
        print('  错误:', data['error'][:200])
    else:
        print(' ', data)

server.shutdown()
print('\n代理关闭')