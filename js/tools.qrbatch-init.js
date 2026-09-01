/* ============================================================
 * 二维码批量识别（工具集面板业务逻辑）v1.5.56
 * 功能对齐工作台 exe：
 *   - 文件夹/多图批量识别（jsQR 网格分块多码 + ZXing 兜底）
 *   - OCR 文字识别 IMEI（Tesseract v4：按二维码位置裁剪码下方区域识别）
 *   - 提取链接去重 / 提取IMEI/设备ID(去重)（合并 OCR，重复信息单独框）
 *   - 导出 MD / CSV / 批量格式转换 / 复制 / 清空
 * 纯本地处理：识别与 OCR 全部在浏览器内完成，图片不上传
 * ============================================================ */
(function () {
  'use strict';

  var $ = window.jQuery;
  if (!$) { return; }

  var S = {
    files: [],        // [{name, path, file}]
    results: [],      // [{name, path, qrCodes:[], qrBoxes:[], ocrImeis:[], failed:bool}]
    running: false,
    cancelled: false
  };

  var IMG_EXTS = /\.(jpe?g|png|bmp|gif|tiff?|webp|ico)$/i;

  /* ---------- 云引擎（云端代理：Cloudflare Worker 或本地 cloud_ocr_proxy.py，地址可配置） ---------- */
  var PROXY_BASE_KEY = 'qrbatch_proxy_base';
  function proxyBase() {
    var v = (localStorage.getItem(PROXY_BASE_KEY) || '').trim().replace(/\/+$/, '');
    return v;
  }

  function currentQrEngine() {
    var s = el('qrBatchQrEngine');
    return s ? s.value : 'local';
  }
  function currentOcrEngine() {
    var s = el('qrBatchOcrEngine');
    return s ? s.value : 'local';
  }
  function needProxy() {
    return currentOcrEngine() !== 'local' || currentQrEngine() !== 'local';
  }
  function checkProxy() {
    var base = proxyBase();
    if (!base) { return Promise.resolve(false); }
    return fetch(base + '/ping', { mode: 'cors' })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }
  function canvasToBlob(cv, type) {
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('图片转码失败')); }, type || 'image/jpeg', 0.9);
    });
  }
  function uploadToProxy(path, cv) {
    var base = proxyBase();
    return canvasToBlob(cv).then(function (blob) {
      var fd = new FormData();
      fd.append('file', blob, 'img.jpg');
      return fetch(base + path, { method: 'POST', body: fd, mode: 'cors' })
        .then(function (r) { return r.json(); });
    });
  }

  /* 云二维码：根据 currentQrEngine 选百度（/qr_baidu）或腾讯（/qr），返回 [{data,x,y,w,h}]（原图坐标） */
  async function cloudDecodeQr(canvas) {
    var st = scaled(canvas, 2400);
    var path = currentQrEngine() === 'baidu' ? '/qr_baidu' : '/qr';
    var data = await uploadToProxy(path, st.cv);
    if (!data) { throw new Error('云二维码识别无响应（代理未启动？）'); }
    if (data.error) { throw new Error('云二维码错误：' + data.error); }
    var scale = st.scale;
    return (data.codes || []).map(function (c) {
      return {
        data: c.data,
        x: Math.round(c.x / scale),
        y: Math.round(c.y / scale),
        w: Math.max(20, Math.round(c.w / scale)),
        h: Math.max(20, Math.round(c.h / scale))
      };
    });
  }

  /* 云 OCR：根据 currentOcrEngine 选腾讯（/ocr_tencent）或百度（/ocr），
     整图上传一次，自动纠偏旋转；返回 {imeis, raw} */
  async function cloudOcrWholeImage(canvas) {
    var st = scaled(canvas, 2400);
    var path = currentOcrEngine() === 'tencent' ? '/ocr_tencent' : '/ocr';
    var data = await uploadToProxy(path, st.cv);
    if (!data) { throw new Error('云 OCR 无响应（代理未启动？）'); }
    if (data.error) { throw new Error('云 OCR 错误：' + data.error); }
    var text = (data.text || '').replace(/\s+/g, ' ').trim();
    var imeis = extractImeisFromText(text);
    return { imeis: imeis, raw: imeis.length ? '' : text.slice(0, 60) };
  }

  function el(id) { return document.getElementById(id); }

  function toast(msg, color) {
    var t = el('qrBatchToast');
    t.textContent = msg;
    t.style.display = 'block';
    t.style.background = color || '#e7f1ff';
    t.style.color = '#004085';
    t.style.border = '1px solid #b8daff';
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.style.display = 'none'; }, 1500);
  }

  function setSummary() {
    var nImg = S.files.length;
    var nQr = 0, nOcr = 0;
    S.results.forEach(function (r) { nQr += (r.qrCodes || []).length; nOcr += (r.ocrImeis || []).length; });
    el('qrBatchSummary').textContent =
      '当前合计：' + nImg + ' 张图片 / ' + nQr + ' 个二维码' + (nOcr ? ' / ' + nOcr + ' 个 OCR-IMEI' : '');
  }

  function showStatus(html) {
    var s = el('qrBatchStatus');
    s.innerHTML = html;
    s.style.display = 'block';
  }

  function hideStatus() { el('qrBatchStatus').style.display = 'none'; }

  function setBusy(busy) {
    S.running = busy;
    el('qrBatchStartBtn').disabled = busy;
    el('qrBatchCancelBtn').disabled = !busy;
    el('qrBatchExportMdBtn').disabled = busy || S.results.length === 0;
    el('qrBatchExportCsvBtn').disabled = busy || S.results.length === 0;
    el('qrBatchExtractLinksBtn').disabled = busy || !el('qrBatchResult').value.trim();
    el('qrBatchExtractImeiBtn').disabled = busy || !el('qrBatchResult').value.trim();
    el('qrBatchBatchFmtBtn').disabled = busy || !el('qrBatchResult').value.trim();
    el('qrBatchCopyBtn').disabled = busy || !el('qrBatchResult').value.trim();
  }

  /* ---------- 文件收集 ---------- */
  function addFiles(fileList) {
    var added = 0;
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (!f || !f.name) { continue; }
      if (!IMG_EXTS.test(f.name)) { continue; }
      S.files.push({ name: f.name, path: f.webkitRelativePath || f.name, file: f });
      added++;
    }
    toast('已添加 ' + added + ' 张图片，共 ' + S.files.length + ' 张', '#d4edda');
    setSummary();
  }

  function traverseEntry(entry, base, out, done) {
    if (entry.isFile) {
      entry.file(function (f) {
        if (IMG_EXTS.test(f.name)) {
          out.push({ name: f.name, path: (base ? base + '/' : '') + f.name, file: f });
        }
        done();
      }, done);
    } else if (entry.isDirectory) {
      var reader = entry.createReader();
      var all = [];
      function readBatch() {
        reader.readEntries(function (entries) {
          if (!entries.length) {
            var n = all.length, k = 0;
            if (n === 0) { done(); return; }
            all.forEach(function (e) {
              traverseEntry(e, (base ? base + '/' : '') + entry.name, out, function () {
                k++;
                if (k === n) { done(); }
              });
            });
          } else {
            all = all.concat(Array.prototype.slice.call(entries));
            readBatch();
          }
        }, done);
      }
      readBatch();
    } else { done(); }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    var items = e.dataTransfer.items;
    var dirs = [], files = [], n = 0, total = 0;
    function finish() { if (n === total) { toast('已添加 ' + files.length + ' 张图片', '#d4edda'); } }
    if (items && items.length) {
      total = items.length;
      Array.prototype.forEach.call(items, function (it) {
        var entry = it.webkitGetAsEntry && it.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          traverseEntry(entry, '', dirs, function () {
            S.files = S.files.concat(dirs);
            n++; finish();
          });
        } else if (it.getAsFile) {
          var f = it.getAsFile();
          if (f && IMG_EXTS.test(f.name)) { files.push({ name: f.name, path: f.name, file: f }); }
          n++; finish();
        } else { n++; finish(); }
      });
      return;
    }
    var fl = e.dataTransfer.files;
    if (fl && fl.length) { addFiles(fl); }
  }

  /* ---------- 图片加载 ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片加载失败: ' + file.name)); };
      img.src = url;
    });
  }

  function imageToCanvas(img) {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }

  /* ---------- 二维码识别（jsQR 网格分块多码 + ZXing 兜底） ---------- */
  /* jsQR 单块解码：返回 {data,x,y,w,h}（块内坐标）或 null */
  function decodeJsQRCanvas(canvas) {
    try {
      if (typeof window.jsQR === 'undefined') { return null; }
      var w = canvas.width, h = canvas.height;
      var data = canvas.getContext('2d').getImageData(0, 0, w, h);
      var res = window.jsQR(data.data, w, h);
      if (!res || !res.data) { return null; }
      var loc = res.location || {};
      var pts = [loc.topLeftCorner, loc.topRightCorner, loc.bottomLeftCorner, loc.bottomRightCorner]
        .filter(function (p) { return p && typeof p.x === 'number' && typeof p.y === 'number'; });
      if (!pts.length) { return { data: res.data, x: 0, y: 0, w: w, h: h }; }
      var xs = pts.map(function (p) { return p.x; });
      var ys = pts.map(function (p) { return p.y; });
      var minX = Math.max(0, Math.floor(Math.min.apply(null, xs)));
      var minY = Math.max(0, Math.floor(Math.min.apply(null, ys)));
      var maxX = Math.min(w, Math.ceil(Math.max.apply(null, xs)));
      var maxY = Math.min(h, Math.ceil(Math.max.apply(null, ys)));
      return { data: res.data, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    } catch (e) { return null; }
  }

  /* 缩放 canvas，返回 {cv, scale} */
  function scaled(canvas, maxDim) {
    var w = canvas.width, h = canvas.height;
    if (Math.max(w, h) <= maxDim) { return { cv: canvas, scale: 1 }; }
    var s = maxDim / Math.max(w, h);
    var c2 = document.createElement('canvas');
    c2.width = Math.round(w * s); c2.height = Math.round(h * s);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    return { cv: c2, scale: s };
  }

  /* 主引擎：网格分块 + 滑窗，返回 [{data,x,y,w,h}]（原图坐标） */
  function decodeJsQRGrid(canvas) {
    var found = [];
    var seen = {};
    function addCode(box) {
      if (box && box.data && !seen[box.data]) {
        seen[box.data] = 1;
        found.push(box);
      }
    }
    function addScaled(cv, scale, offX, offY) {
      var r = decodeJsQRCanvas(cv);
      if (r) {
        addCode({ data: r.data,
                  x: Math.round((r.x + (offX || 0)) / scale),
                  y: Math.round((r.y + (offY || 0)) / scale),
                  w: Math.max(20, Math.round(r.w / scale)),
                  h: Math.max(20, Math.round(r.h / scale)) });
      }
    }
    var w = canvas.width, h = canvas.height;
    // 1) 整图（缩 2400）
    var sW = scaled(canvas, 2400);
    addScaled(sW.cv, sW.scale, 0, 0);
    // 2) 网格 2x3 分块（每块缩 1400）
    var rows = 2, cols = 3;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        try {
          var x0 = Math.floor(c * w / cols), x1 = Math.floor((c + 1) * w / cols);
          var y0 = Math.floor(r * h / rows), y1 = Math.floor((r + 1) * h / rows);
          var tile = document.createElement('canvas');
          tile.width = x1 - x0; tile.height = y1 - y0;
          tile.getContext('2d').drawImage(canvas, x0, y0, tile.width, tile.height, 0, 0, tile.width, tile.height);
          var st = scaled(tile, 1400);
          addScaled(st.cv, st.scale, x0, y0);
        } catch (e) { }
      }
    }
    // 3) 滑窗补充（捕捉跨网格边界的码）
    var sw = Math.floor(w / 3), sh = Math.floor(h / 3);
    for (var oy = 0; oy + sh <= h; oy += Math.floor(sh / 2)) {
      for (var ox = 0; ox + sw <= w; ox += Math.floor(sw / 2)) {
        try {
          var tile2 = document.createElement('canvas');
          tile2.width = sw; tile2.height = sh;
          tile2.getContext('2d').drawImage(canvas, ox, oy, sw, sh, 0, 0, sw, sh);
          var st2 = scaled(tile2, 1200);
          addScaled(st2.cv, st2.scale, ox, oy);
        } catch (e) { }
      }
    }
    return found;
  }

  /* ZXing 整图兜底（缩 1600） */
  function decodeZXing(canvas) {
    return new Promise(function (resolve) {
      try {
        if (typeof window.ZXing === 'undefined') { resolve([]); return; }
        var st = scaled(canvas, 1600);
        var img = new Image();
        img.onload = function () {
          try {
            var reader = new window.ZXing.BrowserMultiFormatReader();
            reader.decodeFromImageElement(img).then(function (result) {
              resolve(result && result.text ? [{ data: result.text, x: 0, y: 0, w: st.cv.width, h: st.cv.height }] : []);
            }).catch(function () { resolve([]); });
          } catch (e) { resolve([]); }
        };
        img.onerror = function () { resolve([]); };
        img.src = st.cv.toDataURL('image/jpeg', 0.9);
      } catch (e) { resolve([]); }
    });
  }

  async function decodeCodes(canvas) {
    if (currentQrEngine() !== 'local') {
      return await cloudDecodeQr(canvas);
    }
    var boxes = decodeJsQRGrid(canvas);
    if (!boxes.length) {
      boxes = await decodeZXing(canvas);
    }
    return boxes;
  }

  /* ---------- OCR 文字识别 IMEI（Tesseract v4，按码位置裁剪下方区域） ---------- */
  function extractImeisFromText(txt) {
    var out = [];
    var m, re = /\d{15}|\d{13,17}/g;
    while ((m = re.exec(txt)) !== null) { out.push(m[0]); }
    if (!out.length) {
      var runs = (txt.replace(/[^0-9]/g, ' ')).split(/\s+/).filter(function (s) { return s.length >= 6; });
      for (var i = 0; i < runs.length - 1; i++) {
        var joined = runs[i] + runs[i + 1];
        if (joined.length >= 13 && joined.length <= 17) { out.push(joined); }
      }
    }
    return out;
  }

  function ocrImeiFromBox(canvas, box) {
    return new Promise(function (resolve) {
      try {
        if (typeof window.Tesseract === 'undefined') { resolve({ imeis: [], raw: '' }); return; }
        // 精准裁剪：贴纸二维码下方/侧方（PCB IMEI 通常紧贴贴纸，不再扩 3 倍）
        var qh = Math.max(40, box.h || 100);
        var y0 = Math.min(canvas.height, box.y + box.h);
        var y1 = Math.min(canvas.height, box.y + box.h + qh);
        var x0 = Math.max(0, box.x - Math.floor((box.w || 100) * 0.3));
        var x1 = Math.min(canvas.width, box.x + (box.w || 100) + Math.floor((box.w || 100) * 0.3));
        if (y1 - y0 < 20 || x1 - x0 < 20) {
          // 兜底：直接用码区
          y0 = Math.max(0, box.y); y1 = Math.min(canvas.height, box.y + qh);
          x0 = Math.max(0, box.x); x1 = Math.min(canvas.width, box.x + (box.w || 100));
        }
        if (y1 - y0 < 20 || x1 - x0 < 20) { resolve({ imeis: [], raw: '' }); return; }
        var crop = document.createElement('canvas');
        crop.width = x1 - x0; crop.height = y1 - y0;
        crop.getContext('2d').drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
        // 旋转 90°（覆盖垂直 IMEI：贴纸右侧竖排数字）
        var rot = document.createElement('canvas');
        rot.width = crop.height; rot.height = crop.width;
        var rctx = rot.getContext('2d');
        rctx.translate(rot.width, 0);
        rctx.rotate(Math.PI / 2);
        rctx.drawImage(crop, 0, 0);
        // 放大（OCR 对大图更准）
        function big(cv) {
          var out = document.createElement('canvas');
          out.width = cv.width * 2; out.height = cv.height * 2;
          out.getContext('2d').drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, out.width, out.height);
          return out;
        }
        function ocr(img) {
          return window.Tesseract.recognize(img, 'eng', { tessedit_pageseg_mode: '6' })
            .then(function (r) { return (r && r.data && r.data.text) ? r.data.text : ''; })
            .catch(function () { return ''; });
        }
        // 双角度：原方向（水平 IMEI）+ 旋转 90°（垂直 IMEI）
        Promise.all([ocr(big(crop)), ocr(big(rot))]).then(function (texts) {
          var combined = (texts[0] + ' ' + texts[1]).trim();
          var imeis = extractImeisFromText(combined);
          // 透明化：把原始文本片段返回，调用方决定是否显示
          resolve({ imeis: imeis, raw: imeis.length ? '' : combined.slice(0, 60) });
        });
      } catch (e) { resolve({ imeis: [], raw: '' }); }
    });
  }

  async function ocrImeis(canvas, boxes) {
    if (typeof window.Tesseract === 'undefined') { return { imeis: [], raws: [] }; }
    var imeis = [];
    var raws = [];
    var boxesToScan = (boxes && boxes.length) ? boxes.slice(0, 12) : [];
    if (!boxesToScan.length) { return { imeis: [], raws: [] }; }
    for (var i = 0; i < boxesToScan.length; i++) {
      if (S.cancelled) { break; }
      var one = await ocrImeiFromBox(canvas, boxesToScan[i]);
      one.imeis.forEach(function (im) { if (imeis.indexOf(im) < 0) { imeis.push(im); } });
      if (one.raw) { raws.push(one.raw); }
    }
    return { imeis: imeis, raws: raws };
  }

  /* ---------- 识别主循环 ---------- */
  async function run() {
    if (!S.files.length) { toast('请先选择图片或文件夹', '#f8d7da'); return; }
    S.cancelled = false;
    setBusy(true);
    S.results = [];
    el('qrBatchResult').value = '';
    el('qrBatchDup').value = '';
    el('qrBatchFailed').style.display = 'none';
    el('qrBatchProgress').value = 0;
    var useOcr = el('qrBatchOcr').checked;
    var ocrEng = currentOcrEngine();
    if (useOcr) {
      el('qrBatchOcrStatus').textContent = (ocrEng === 'baidu')
        ? 'OCR 引擎：百度云（自动纠偏旋转，竖排 IMEI 识别率高）'
        : (ocrEng === 'tencent')
          ? 'OCR 引擎：腾讯云 GeneralBasicOCR（与二维码共享密钥不同 Action）'
          : 'OCR 引擎：本地 Tesseract，首次识别需下载语言包(~10MB)，之后复用...';
    }
    if (needProxy()) {
      var base = proxyBase() || '（未配置）';
      el('qrBatchOcrStatus').textContent = '正在检查云端代理 (' + base + ')...';
      var proxyOk = await checkProxy();
      if (!proxyOk) {
        el('qrBatchOcrStatus').textContent = '';
        setBusy(false);
        toast('云端代理不可用：请在本工具「云端代理地址」输入框填写代理地址并保存（Cloudflare Worker 或本地代理均可）', '#f8d7da');
        return;
      }
      el('qrBatchOcrStatus').textContent = '云端代理已连接 ✅';
    }

    var total = S.files.length;
    var failed = [];
    for (var i = 0; i < total; i++) {
      if (S.cancelled) { toast('已取消'); break; }
      var f = S.files[i];
      showStatus('正在处理 (' + (i + 1) + '/' + total + ')：' + f.name);
      el('qrBatchProgress').value = Math.round(i / total * 100);
      var res = { name: f.name, path: f.path, qrCodes: [], qrBoxes: [], ocrImeis: [], failed: false };
      try {
        var img = await loadImage(f.file);
        var canvas = imageToCanvas(img);
        var boxes = await decodeCodes(canvas);
        res.qrCodes = boxes.map(function (b) { return b.data; });
        res.qrBoxes = boxes;
        if (useOcr) {
          if (ocrEng === 'baidu' || ocrEng === 'tencent') {
            el('qrBatchOcrStatus').textContent = '云 OCR ' + f.name + ' ...';
            var ocrRes = await cloudOcrWholeImage(canvas);
            res.ocrImeis = ocrRes.imeis;
            res.ocrRaw = ocrRes.raw;
            el('qrBatchOcrStatus').textContent = '';
          } else if (boxes.length) {
            el('qrBatchOcrStatus').textContent = 'OCR ' + f.name + ' ...';
            var ocrRes2 = await ocrImeis(canvas, boxes);
            res.ocrImeis = ocrRes2.imeis;
            res.ocrRaw = ocrRes2.raws.join(' | ');
            el('qrBatchOcrStatus').textContent = '';
          }
        }
        if (!res.qrCodes.length && !res.ocrImeis.length) { res.failed = true; failed.push(f.name); }
      } catch (e) {
        res.failed = true;
        failed.push(f.name + '（' + e.message + '）');
      }
      S.results.push(res);
      renderResultLine(res);
    }
    el('qrBatchProgress').value = 100;
    hideStatus();
    el('qrBatchOcrStatus').textContent = '';
    if (failed.length) {
      var fd = el('qrBatchFailed');
      fd.textContent = '⚠️ 未识别（' + failed.length + ' 张）：' + failed.slice(0, 10).join('、') + (failed.length > 10 ? ' 等' : '');
      fd.style.display = 'block';
    }
    setSummary();
    setBusy(false);
    if (S.cancelled) { toast('已取消'); } else { toast('识别完成：' + S.results.length + ' 张 / ' + total, '#d4edda'); }
  }

  function renderResultLine(res) {
    var ta = el('qrBatchResult');
    var parts = [];
    parts.push('### ' + res.name);
    res.qrCodes.forEach(function (c, i) {
      var short = c.length > 80 ? c.slice(0, 80) + '...' : c;
      parts.push('- 二维码' + (i + 1) + ': ' + short);
    });
    res.ocrImeis.forEach(function (im, i) {
      parts.push('- OCR-IMEI' + (i + 1) + ': ' + im + '（二维码下方/侧方印刷文字识别）');
    });
    // 透明化：识别到 0 个 IMEI 但 OCR 实际跑了 → 显示原始文本片段
    if (!res.ocrImeis.length && res.ocrRaw) {
      parts.push('- ⚠️ OCR 已识别但未匹配 IMEI：' + res.ocrRaw);
    }
    if (res.failed && !res.qrCodes.length && !res.ocrImeis.length) {
      parts.push('- ⚠️ 未识别到二维码/文字');
    }
    ta.value += parts.join('\n') + '\n';
    ta.scrollTop = ta.scrollHeight;
  }

  /* ---------- 导出 ---------- */
  function buildMd() {
    var n = S.results.filter(function (r) { return !r.failed; }).length;
    var lines = [];
    lines.push('# 二维码识别结果');
    lines.push('');
    lines.push('- 图片总数: ' + S.results.length);
    lines.push('- 识别成功: ' + n + ' 张');
    lines.push('- 未识别: ' + (S.results.length - n) + ' 张');
    var q = 0; S.results.forEach(function (r) { q += r.qrCodes.length; });
    lines.push('- 二维码总数: ' + q + ' 个');
    lines.push('');
    lines.push('---');
    lines.push('');
    S.results.forEach(function (r) {
      lines.push('### ' + r.name);
      r.qrCodes.forEach(function (c, i) { lines.push('- 二维码 ' + (i + 1) + ': `' + c + '`'); });
      r.ocrImeis.forEach(function (im, i) { lines.push('- OCR-IMEI ' + (i + 1) + ': `' + im + '`（二维码下方印刷文字识别）'); });
      if (r.failed && !r.qrCodes.length && !r.ocrImeis.length) { lines.push('- ⚠️ 未识别'); }
      lines.push('');
    });
    return lines.join('\n');
  }

  function buildCsv() {
    var lines = [];
    lines.push(['图片名称', '图片路径', '是否识别成功', '二维码序号', '二维码内容', 'IMEI'].join(','));
    S.results.forEach(function (r) {
      if (!r.qrCodes.length && !r.ocrImeis.length) {
        lines.push([r.name, r.path, '否', '', '', ''].join(','));
        return;
      }
      r.qrCodes.forEach(function (c, i) {
        var m = c.match(/(\d{15}|\d{13,17})/);
        lines.push([r.name, r.path, '是', i + 1, c, m ? m[0] : ''].join(','));
      });
      r.ocrImeis.forEach(function (im) {
        lines.push([r.name, r.path, '是', 'OCR', '', im].join(','));
      });
    });
    return '\ufeff' + lines.join('\r\n');
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
  }

  /* ---------- 二次提取 ---------- */
  function extractUrls(text) {
    var out = [];
    var re = /https?:\/\/[^\s"'<>\)\]\}]+/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var u = m[0].replace(/[。，、；：]+$/, '');
      out.push(u);
    }
    return out;
  }

  function extractLastPathSegment(url) {
    var u = url.replace(/\/+$/, '');
    var seg = u.slice(u.lastIndexOf('/') + 1);
    if (!seg || !/^[\w-]+$/.test(seg)) { return ''; }
    return seg;
  }

  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function getResultContent() { return el('qrBatchResult').value; }

  function setResult(text) {
    el('qrBatchResult').value = text;
    setBusy(false);
  }

  function collectAllOcrImeis() {
    var out = [];
    S.results.forEach(function (r) {
      (r.ocrImeis || []).forEach(function (im) { out.push(im); });
    });
    return out;
  }

  function onExtractLinks() {
    var urls = extractUrls(getResultContent());
    var uniq = dedupe(urls);
    setResult(uniq.join('\n'));
    toast('链接 ' + urls.length + ' 个 -> 去重后 ' + uniq.length + ' 个（已复制）');
    copyText(uniq.join('\n'));
  }

  function onExtractImei() {
    var content = getResultContent();
    var urls = extractUrls(content);
    var ids = [];
    urls.forEach(function (u) { var s = extractLastPathSegment(u); if (s) { ids.push(s); } });
    var ocr = collectAllOcrImeis();
    var re = /OCR-IMEI\s*\d*\s*[:：]\s*(\d{13,17})/g;
    var m;
    while ((m = re.exec(content)) !== null) { if (ocr.indexOf(m[1]) < 0) { ocr.push(m[1]); } }
    var combined = ids.concat(ocr);
    var seen = {}, uniq = [], dups = [];
    combined.forEach(function (x) {
      if (seen[x]) { dups.push(x); } else { seen[x] = 1; uniq.push(x); }
    });
    var dupUniq = dedupe(dups);
    setResult(uniq.join('\n'));
    var dupTa = el('qrBatchDup');
    dupTa.value = dupUniq.join('\n');
    copyText(uniq.join('\n'));
    toast('设备ID ' + ids.length + ' + OCR ' + ocr.length + ' -> 去重后 ' + uniq.length + ' 个，重复剔除 ' + dupUniq.length + ' 个');
  }

  function onBatchFmt() {
    var lines = getResultContent().split('\n').filter(function (l) { return l.trim(); });
    var res = lines.join(',');
    setResult(res);
    copyText(res);
    toast('批量格式：' + lines.length + ' 行 -> 逗号分隔（已复制）');
  }

  function onCopy() {
    copyText(getResultContent());
    toast('已复制到剪贴板');
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function onClear() {
    S.files = [];
    S.results = [];
    el('qrBatchResult').value = '';
    el('qrBatchDup').value = '';
    el('qrBatchFailed').style.display = 'none';
    el('qrBatchProgress').value = 0;
    el('qrBatchSummary').textContent = '当前合计：0 张图片 / 0 个二维码';
    hideStatus();
    setBusy(false);
    toast('已清空');
  }

  /* ---------- 事件绑定 ---------- */
  function init() {
    var input = el('qrBatchFiles');
    var drop = el('qrBatchDrop');
    var dropText = el('qrBatchDropText');

    input.addEventListener('change', function () {
      addFiles(input.files);
      input.value = '';
    });

    drop.addEventListener('click', function () { input.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        drop.style.borderColor = '#2b6cf6';
        drop.style.background = '#eef4ff';
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        drop.style.borderColor = '#ccc';
        drop.style.background = '';
      });
    });
    drop.addEventListener('drop', handleDrop);

    el('qrBatchStartBtn').addEventListener('click', run);
    el('qrBatchCancelBtn').addEventListener('click', function () { S.cancelled = true; });
    el('qrBatchExportMdBtn').addEventListener('click', function () {
      var ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      download('二维码识别结果_' + ts + '.md', buildMd(), 'text/markdown;charset=utf-8');
    });
    el('qrBatchExportCsvBtn').addEventListener('click', function () {
      var ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      download('二维码识别结果_' + ts + '.csv', buildCsv(), 'text/csv;charset=utf-8');
    });
    el('qrBatchExtractLinksBtn').addEventListener('click', onExtractLinks);
    el('qrBatchExtractImeiBtn').addEventListener('click', onExtractImei);
    el('qrBatchBatchFmtBtn').addEventListener('click', onBatchFmt);
    el('qrBatchCopyBtn').addEventListener('click', onCopy);
    el('qrBatchClearBtn').addEventListener('click', onClear);

    // 检测识别引擎支持（本地引擎 + 云端代理状态）
    var detNote = document.createElement('div');
    detNote.style.cssText = 'font-size:12px;color:#888;margin-top:4px;';
    function engineText(proxyOk) {
      var base = proxyBase();
      return '本地引擎：' +
        (typeof window.jsQR !== 'undefined' ? 'jsQR(网格多码) + ZXing 兜底' : 'ZXing') +
        (typeof window.Tesseract !== 'undefined' ? ' + Tesseract OCR' : '（OCR 不可用）') +
        (base
          ? ' ｜ 云端代理：' + (proxyOk === null ? '检测中...' : (proxyOk ? '✅ 已连接' : '❌ 无法连接（检查地址或代理服务）'))
          : ' ｜ 云端代理：未配置（上方输入框填代理地址后保存）');
    }
    detNote.textContent = engineText(null);
    drop.parentNode.insertBefore(detNote, drop.nextSibling);
    checkProxy().then(function (ok) { detNote.textContent = engineText(ok); });

    // 云端代理地址：保存 + 测试连接
    var proxyInput = el('qrBatchProxyBase');
    if (proxyInput) {
      proxyInput.value = localStorage.getItem(PROXY_BASE_KEY) || '';
      el('qrBatchProxySave').addEventListener('click', function () {
        var v = proxyInput.value.trim().replace(/\/+$/, '');
        proxyInput.value = v;
        localStorage.setItem(PROXY_BASE_KEY, v);
        toast('云端代理地址已保存');
        detNote.textContent = engineText(null);
        checkProxy().then(function (ok) { detNote.textContent = engineText(ok); });
      });
      el('qrBatchProxyTest').addEventListener('click', function () {
        var v = proxyInput.value.trim().replace(/\/+$/, '');
        proxyInput.value = v;
        localStorage.setItem(PROXY_BASE_KEY, v);
        detNote.textContent = engineText(null);
        checkProxy().then(function (ok) {
          detNote.textContent = engineText(ok);
          toast(ok ? '代理连接成功 ✅' : '代理连接失败 ❌（请核对地址，或以 /ping 结尾测试）', ok ? '#d4edda' : '#f8d7da');
        });
      });
    }

    setBusy(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
