/* ============================================================
 * cloud_ocr_worker.js — Cloudflare Workers 云 OCR/二维码代理
 * 免本地代理：网页版直接调用本 Worker，密钥放在 Worker 环境变量（不公开）
 *
 * 部署（一次性）：
 *   1. 注册/登录 Cloudflare → Workers & Pages → 创建 Worker
 *   2. 粘贴本文件全部内容 → 部署
 *   3. Settings → Variables：设置 4 个环境变量
 *        BAIDU_API_KEY / BAIDU_SECRET_KEY         百度智能云（5万次/天免费 OCR）
 *        TENCENT_SECRET_ID / TENCENT_SECRET_KEY   腾讯云 CAM（OCR+二维码各 1000 次/月）
 *   4. 部署后得到地址 https://<worker名>.<子域>.workers.dev
 *   5. 网页版「云端代理地址」填该地址 → 保存 → 选择云引擎即可用
 *
 * 端点（与本地版 cloud_ocr_proxy.py 完全一致，可无缝切换）：
 *   GET  /ping         健康检查 -> {"ok": true}
 *   POST /ocr          百度通用文字识别 general_basic（detect_direction 自动纠偏）
 *   POST /ocr_tencent  腾讯 GeneralBasicOCR
 *   POST /qr           腾讯 QrcodeOCR（TC3-HMAC-SHA256 签名）
 *   POST /qr_baidu     百度二维码识别 qrcode
 * ============================================================ */

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
const BAIDU_QR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/qrcode';
const TC_HOST = 'ocr.tencentcloudapi.com';
const TC_VERSION = '2018-11-19';
const TC_REGION = 'ap-guangzhou';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS),
  });
}

/* ---------------- 通用工具 ---------------- */
function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}
function sha256Hex(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(bytesToHex);
}
function hmacSha256(key, msg) {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  return crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(function (c) { return crypto.subtle.sign('HMAC', c, new TextEncoder().encode(msg)); });
}
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

/* ---------------- 腾讯云 TC3-HMAC-SHA256 签名（WebCrypto 异步实现） ---------------- */
async function tc3Sign(secretId, secretKey, action, payloadStr, timestamp) {
  const service = 'ocr';
  const host = TC_HOST;
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const ct = 'application/json; charset=utf-8';
  const canonicalHeaders = 'content-type:' + ct + '\nhost:' + host + '\nx-tc-action:' + action.toLowerCase() + '\n';
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST', '/', '',
    canonicalHeaders, signedHeaders,
    await sha256Hex(payloadStr),
  ].join('\n');
  const credentialScope = date + '/' + service + '/tc3_request';
  const stringToSign = [
    'TC3-HMAC-SHA256', String(timestamp), credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = await hmacSha256('TC3' + secretKey, date);
  const kService = await hmacSha256(kDate, service);
  const kSigning = await hmacSha256(kService, 'tc3_request');
  const signature = bytesToHex(await hmacSha256(kSigning, stringToSign));
  return 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

async function tcCall(env, action, body) {
  if (!env.TENCENT_SECRET_ID || !env.TENCENT_SECRET_KEY) {
    throw new Error('腾讯密钥未配置：请在 Worker 环境变量设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadStr = JSON.stringify(body);
  const authorization = await tc3Sign(env.TENCENT_SECRET_ID, env.TENCENT_SECRET_KEY, action, payloadStr, timestamp);
  const res = await fetch('https://' + TC_HOST + '/', {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'X-TC-Action': action,
      'X-TC-Version': TC_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': TC_REGION,
    },
    body: payloadStr,
  });
  const data = await res.json();
  const rb = data.Response || {};
  if (rb.Error) {
    throw new Error('腾讯云错误[' + (rb.Error.Code || '') + ']: ' + (rb.Error.Message || ''));
  }
  return rb;
}

async function tencentQr(imgBuf, env) {
  const b64 = bufToBase64(imgBuf);
  const rb = await tcCall(env, 'QrcodeOCR', { ImageBase64: b64 });
  const codes = [];
  for (const cr of (rb.CodeResults || [])) {
    const content = cr.Url || cr.Data || '';
    let x = 0, y = 0, w = 0, h = 0;
    const pos = cr.Position || {};
    const pts = ['LeftTop', 'RightTop', 'LeftBottom', 'RightBottom']
      .map(function (k) { return pos[k]; })
      .filter(function (p) { return p && typeof p.X === 'number' && typeof p.Y === 'number'; });
    if (pts.length) {
      const xs = pts.map(function (p) { return p.X; });
      const ys = pts.map(function (p) { return p.Y; });
      x = Math.min.apply(null, xs);
      w = Math.max.apply(null, xs) - x;
      y = Math.min.apply(null, ys);
      h = Math.max.apply(null, ys) - y;
    }
    codes.push({
      data: content,
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      w: Math.max(10, Math.round(w)),
      h: Math.max(10, Math.round(h)),
    });
  }
  return codes;
}

async function tencentOcr(imgBuf, env) {
  const b64 = bufToBase64(imgBuf);
  const rb = await tcCall(env, 'GeneralBasicOCR', { ImageBase64: b64, LanguageType: 'auto' });
  const texts = (rb.TextDetections || []).map(function (t) { return t.DetectedText || ''; });
  return texts.filter(Boolean).join('\n');
}

/* ---------------- 百度智能云 ---------------- */
let _bdToken = null;
let _bdExpire = 0;

async function baiduToken(env) {
  if (!env.BAIDU_API_KEY || !env.BAIDU_SECRET_KEY) {
    throw new Error('百度密钥未配置：请在 Worker 环境变量设置 BAIDU_API_KEY / BAIDU_SECRET_KEY');
  }
  if (_bdToken && Date.now() < _bdExpire - 300000) return _bdToken;
  const url = BAIDU_TOKEN_URL + '?grant_type=client_credentials&client_id=' + encodeURIComponent(env.BAIDU_API_KEY) +
    '&client_secret=' + encodeURIComponent(env.BAIDU_SECRET_KEY);
  const res = await fetch(url);
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('百度 token 获取失败: ' + (data.error_description || JSON.stringify(data)));
  }
  _bdToken = data.access_token;
  _bdExpire = Date.now() + (data.expires_in || 2592000) * 1000;
  return _bdToken;
}

async function baiduPost(env, apiUrl, imgBuf, extra) {
  const token = await baiduToken(env);
  const params = { image: bufToBase64(imgBuf) };
  Object.assign(params, extra || {});
  const res = await fetch(apiUrl + '?access_token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return await res.json();
}

async function baiduOcr(imgBuf, env) {
  const data = await baiduPost(env, BAIDU_OCR_URL, imgBuf, { detect_direction: 'true' });
  if (!data.words_result) {
    throw new Error('百度 OCR 失败: ' + (data.error_msg || JSON.stringify(data)));
  }
  return (data.words_result || []).map(function (w) { return w.words || ''; }).filter(Boolean).join('\n');
}

async function baiduQr(imgBuf, env) {
  const data = await baiduPost(env, BAIDU_QR_URL, imgBuf, {});
  if (!data.codes_result) {
    throw new Error('百度二维码识别失败: ' + (data.error_msg || JSON.stringify(data)));
  }
  const codes = [];
  const keys = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
  for (const cr of (data.codes_result || [])) {
    const loc = cr.location || {};
    const xs = keys.map(function (k) { return (loc[k] || {}).x; }).filter(function (v) { return typeof v === 'number'; });
    const ys = keys.map(function (k) { return (loc[k] || {}).y; }).filter(function (v) { return typeof v === 'number'; });
    let x = 0, y = 0, w = 0, h = 0;
    if (xs.length) { x = Math.min.apply(null, xs); w = Math.max.apply(null, xs) - x; }
    if (ys.length) { y = Math.min.apply(null, ys); h = Math.max.apply(null, ys) - y; }
    const texts = Array.isArray(cr.text) ? cr.text : (cr.text ? [cr.text] : ['']);
    for (const t of texts) {
      if (t) {
        codes.push({
          data: t,
          x: Math.max(0, Math.round(x)),
          y: Math.max(0, Math.round(y)),
          w: Math.max(10, Math.round(w)),
          h: Math.max(10, Math.round(h)),
        });
      }
    }
  }
  return codes;
}

/* ---------------- HTTP 入口 ---------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const path = url.pathname;

    if (request.method === 'GET' && path === '/ping') {
      return json({ ok: true, engine: 'cloud-worker', time: new Date().toISOString() });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    let img = null;
    try {
      const ct = request.headers.get('Content-Type') || '';
      if (ct.indexOf('multipart/') >= 0) {
        const fd = await request.formData();
        const f = fd.get('file');
        if (f) img = await f.arrayBuffer();
      } else {
        img = await request.arrayBuffer(); // 兼容裸 base64 / 原始字节
      }
    } catch (e) {
      return json({ error: '读取图片失败: ' + (e.message || e) }, 400);
    }
    if (!img || !img.byteLength) {
      return json({ error: '未读取到图片数据（Content-Type 需 multipart/form-data 或原始字节）' }, 400);
    }

    try {
      switch (path) {
        case '/ocr':
          return json({ text: await baiduOcr(img, env) });
        case '/ocr_tencent':
          return json({ text: await tencentOcr(img, env) });
        case '/qr':
          return json({ codes: await tencentQr(img, env) });
        case '/qr_baidu':
          return json({ codes: await baiduQr(img, env) });
        default:
          return json({ error: 'not found: ' + path }, 404);
      }
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502);
    }
  },
};
