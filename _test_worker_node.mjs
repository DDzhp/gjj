// Node 环境模拟 Cloudflare Worker：真实密钥测 4 端点
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(process.cwd(), 'config.json'), 'utf-8'));
const env = {
  BAIDU_API_KEY: cfg.baidu_api_key,
  BAIDU_SECRET_KEY: cfg.baidu_secret_key,
  TENCENT_SECRET_ID: cfg.tencent_secret_id,
  TENCENT_SECRET_KEY: cfg.tencent_secret_key,
};

const worker = await import('./cloud_ocr_worker.mjs');
const handler = worker.default.fetch;

async function call(path, imgBuf) {
  const fd = new FormData();
  fd.append('file', new Blob([imgBuf], { type: 'image/jpeg' }), 'img.jpg');
  const req = new Request('https://test.workers.dev' + path, { method: 'POST', body: fd });
  const res = await handler(req, env);
  const body = await res.json();
  return { status: res.status, body };
}

const imgBuf = readFileSync('C:/Users/60969/Desktop/二维码/22/微信图片_20260826132257_232_388.jpg');
console.log('图片大小:', imgBuf.length);

// /ping
let res = await handler(new Request('https://test.workers.dev/ping'), env);
console.log('--- GET /ping ->', res.status, JSON.stringify(await res.json()));

for (const ep of ['/ocr', '/ocr_tencent', '/qr', '/qr_baidu']) {
  const t0 = Date.now();
  try {
    const r = await call(ep, imgBuf);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const d = r.body;
    if (d.codes) {
      console.log(`--- POST ${ep} -> ${r.status} (${dt}s) codes=${d.codes.length}`);
      for (const c of d.codes.slice(0, 3)) console.log('   ', c.x, c.y, c.w, c.h, JSON.stringify(c.data).slice(0, 70));
    } else if (d.text !== undefined) {
      const t = d.text;
      console.log(`--- POST ${ep} -> ${r.status} (${dt}s) text_len=${t.length}`);
      console.log('    首段:', t.slice(0, 120).replace(/\n/g, ' | '));
      const imeis = t.match(/\d{13,17}/g) || [];
      if (imeis.length) console.log('    ★ IMEI 候选:', imeis.slice(0, 5).join(' '));
    } else if (d.error) {
      console.log(`--- POST ${ep} -> ${r.status} (${dt}s) 错误:`, d.error.slice(0, 150));
    } else {
      console.log(`--- POST ${ep} -> ${r.status} (${dt}s)`, JSON.stringify(d).slice(0, 150));
    }
  } catch (e) {
    console.log(`--- POST ${ep} 异常:`, e.message);
  }
}
console.log('\nNode 模拟 Worker 测试完成');
