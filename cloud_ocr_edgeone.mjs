/* ============================================================
 * cloud_ocr_edgeone.mjs — 腾讯云 EdgeOne 边缘函数 云 OCR/二维码代理
 * 免本地代理：网页版直接调用本函数，密钥放在函数环境变量（不公开）
 *
 * ⚠️ 入口规范（EdgeOne 边缘函数 ≠ Cloudflare Workers ≠ EdgeOne Pages，务必注意）：
 *   EdgeOne 边缘函数（函数管理）入口**必须**用 addEventListener('fetch', ...)
 *   ❌ 不要用 export default / onRequest —— 那是 EdgeOne Pages Functions
 *      或 Cloudflare Workers 的写法，边缘函数引擎不识别 → 触发 545 执行异常
 *   ✅ addEventListener 是边缘函数唯一运行入口（仅支持 fetch 事件），
 *      环境变量通过全局变量 env 读取（typeof env 判空兜底）
 *
 * 部署（一次性）：
 *   1. EdgeOne 控制台 → 站点 → 高级能力 → 边缘函数 → 函数管理 → 新建函数
 *   2. 粘贴本文件全部内容 → 创建并部署
 *   3. 配置触发规则（URL Path 等于 /ocr* 和 /qr*，见部署教程）
 *   4. 环境变量：
 *        BAIDU_API_KEY / BAIDU_SECRET_KEY         百度智能云（5万次/天免费 OCR）
 *        TENCENT_SECRET_ID / TENCENT_SECRET_KEY   腾讯云 CAM（OCR+二维码各 1000 次/月）
 *   5. 验证：浏览器打开 https://<域名>/ping → {"ok":true,"engine":"edgeone",...}
 *   6. 网页版「云端代理地址」填 https://<你的域名> → 保存 → 选云引擎即可用
 *
 * 端点（与 cloud_ocr_proxy.py / cloud_ocr_worker.mjs 完全一致，可无缝切换）：
 *   GET  /ping         健康检查 -> {"ok": true, "engine": "edgeone"}
 *   POST /ocr          百度通用文字识别 general_basic（detect_direction 自动纠偏）
 *   POST /ocr_numbers  百度数字识别 v1/numbers（仅返回数字，99%+ 准确率，免费 200 次/天）
 *   POST /ocr_tencent  腾讯 GeneralBasicOCR
 *   POST /qr           腾讯 QrcodeOCR（TC3-HMAC-SHA256 签名）
 *   POST /qr_baidu     百度二维码识别 qrcode
 * ============================================================ */

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';
const BAIDU_NUMBERS_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/numbers';
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
    throw new Error('腾讯密钥未配置：请在函数环境变量设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
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
    throw new Error('百度密钥未配置：请在函数环境变量设置 BAIDU_API_KEY / BAIDU_SECRET_KEY');
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

async function baiduNumbers(imgBuf, env) {
  /* 百度数字识别 v1/numbers：仅返回数字，自动过滤非数字内容，准确率 >99%，免费 200 次/天 */
  const data = await baiduPost(env, BAIDU_NUMBERS_URL, imgBuf, { detect_direction: 'true' });
  if (!data.words_result) {
    throw new Error('百度数字识别失败: ' + (data.error_msg || JSON.stringify(data)));
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

/* ---------------- HTTP 入口 ----------------
 * ⚠️ EdgeOne 边缘函数规范入口（已对照 EdgeOne AI 助手的标准示例验证可跑通）：
 *    - 入口 addEventListener('fetch', event => event.respondWith(handleEvent(event)))
 *    - event.passThroughOnException() 让异常时回源兑底（增强服务可用性）
 *    - 业务函数（baiduOcr/tencentOcr 等）保持原样：返回 Promise，async 函数 OK
 *    - 环境变量：addEventListener 模式下从全局变量 env 读取，typeof 判空兑底
 */
// 监听 fetch 事件
addEventListener('fetch', (event) => {
  // 当函数代码抛出未处理的异常时，边缘函数会转发回源请求处理，增强服务可用性
  event.passThroughOnException();
  const env = (typeof env !== 'undefined' && env) ? env : {};
  event.respondWith(handleEvent(event, env));
});

/**
 * 处理请求（EdgeOne AI 助手标准风格：async + 解构 request + async/await）
 * @param {FetchEvent} event - 请求事件对象
 * @param {object} env - 环境变量
 * @returns {Promise<Response>} 响应体
 */
async function handleEvent(event, env) {
  const { request } = event;
  const url = new URL(request.url);
  const path = url.pathname;

  // OPTIONS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // 健康检查
  if (request.method === 'GET' && path === '/ping') {
    // EdgeOne 特有：request.eo.geo 含地域信息
    const geo = (request.eo && request.eo.geo) || {};
    return json({
      ok: true,
      engine: 'edgeone',
      eo_country: geo.countryName || geo.country || '',
      eo_city: geo.cityName || geo.city || '',
      time: new Date().toISOString(),
    });
  }

  // 其他方法
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  // POST 处理：交给 handlePost（Promise 链模式，内部 .then() 链保持）
  return handlePost(request, path, env);
}
function handlePost(request, path, env) {
  const ct = request.headers.get('Content-Type') || '';
  // 多部分表单 与 裸字节 两路读取，返回 Promise<ArrayBuffer>
  let bodyPromise;
  if (ct.indexOf('multipart/') >= 0) {
    bodyPromise = request.formData().then(function (fd) {
      const f = fd.get('file');
      return f ? f.arrayBuffer() : new ArrayBuffer(0);
    });
  } else {
    bodyPromise = request.arrayBuffer(); // 兼容裸 base64 / 原始字节
  }
  return bodyPromise.then(function (img) {
    if (!img || !img.byteLength) {
      return json({ error: '未读取到图片数据（Content-Type 需 multipart/form-data 或原始字节）' }, 400);
    }
    switch (path) {
      case '/ocr':
        return baiduOcr(img, env).then(function (text) { return json({ text: text }); });
      case '/ocr_numbers':
        return baiduNumbers(img, env).then(function (text) { return json({ text: text }); });
      case '/ocr_tencent':
        return tencentOcr(img, env).then(function (text) { return json({ text: text }); });
      case '/qr':
        return tencentQr(img, env).then(function (codes) { return json({ codes: codes }); });
      case '/qr_baidu':
        return baiduQr(img, env).then(function (codes) { return json({ codes: codes }); });
      default:
        return json({ error: 'not found: ' + path }, 404);
    }
  }).catch(function (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  });
}
