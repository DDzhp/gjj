/*!
 * photoEnhance.js — 拍照强化图片打印处理（UI 接入层）
 * 仅负责界面交互 / 进度 / ZIP 打包 / 结果预览。
 * 重计算在 photoEnhance.core.js（纯函数管线）+ photoEnhance.worker.js（Web Worker）中完成，
 * 主线程不阻塞。
 */
(function (global) {
  'use strict';

  function initPhotoEnhanceTool() {
    var $ = function (id) { return document.getElementById(id); };
    var fileInput = $('photoEnhanceFiles');
    var drop = $('photoEnhanceDrop');
    var dropText = $('photoEnhanceDropText');
    var startBtn = $('photoEnhanceStartBtn');
    var cancelBtn = $('photoEnhanceCancelBtn');
    var downloadBtn = $('photoEnhanceDownloadBtn');
    var clearBtn = $('photoEnhanceClearBtn');
    var progress = $('photoEnhanceProgress');
    var statusEl = $('photoEnhanceStatus');
    var summaryEl = $('photoEnhanceSummary');
    var failedEl = $('photoEnhanceFailed');
    var resultEl = $('photoEnhanceResult');
    var previewEl = $('photoEnhancePreview');
    var modeSel = $('photoEnhanceMode');
    var scaleSel = $('photoEnhanceScale');
    var formatSel = $('photoEnhanceFormat');
    var sauvolaKIn = $('photoEnhanceSauvolaK');
    var noiseKIn = $('photoEnhanceNoiseK');
    var dotRecoveryChk = $('photoEnhanceDotRecovery');
    var lightbox = $('photoEnhanceLightbox');
    var lightboxImg = $('photoEnhanceLightboxImg');
    var lightboxClose = $('photoEnhanceLightboxClose');

    if (!fileInput) return; // 不在本页

    var DEFAULTS = (global.PhotoEnhance && global.PhotoEnhance.DEFAULTS) || { maxSide: 4000 };

    // ---- Worker（不可用时回退主线程）----
    var worker = null;
    try { worker = new Worker('js/photoEnhance.worker.js'); } catch (e) { worker = null; }
    var resolvers = {};
    if (worker) {
      worker.onmessage = function (ev) {
        var d = ev.data; if (!d) return;
        var cb = resolvers[d.id];
        if (cb) { delete resolvers[d.id]; cb(d); }
      };
      worker.onerror = function (ev) {
        // 整 worker 崩溃：把所有进行中的任务标记失败
        Object.keys(resolvers).forEach(function (id) {
          var cb = resolvers[id]; delete resolvers[id];
          cb({ ok: false, error: String(ev.message || 'worker error') });
        });
      };
    }

    var state = {
      files: [], cancelled: false, zip: null, processed: 0, failed: 0, log: [],
      previews: [], // {url, name}
      workerBroken: false
    };

    function setSummary() {
      summaryEl.textContent = '已选择：' + state.files.length + ' 个图片文件';
    }
    function toast(msg, type) {
      statusEl.textContent = msg;
      statusEl.style.display = 'block';
      statusEl.style.background = type === 'error' ? '#f8d7da' : (type === 'success' ? '#d4edda' : '#e7f1ff');
      statusEl.style.borderColor = type === 'error' ? '#f5c6cb' : (type === 'success' ? '#c3e6cb' : '#b8daff');
      statusEl.style.color = type === 'error' ? '#721c24' : (type === 'success' ? '#155724' : '#004085');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { statusEl.style.display = 'none'; }, 2500);
    }

    function collectFiles(list) {
      var exts = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
      var arr = [];
      for (var i = 0; i < list.length; i++) {
        var name = (list[i].name || '').toLowerCase();
        if (exts.some(function (e) { return name.endsWith(e); })) arr.push(list[i]);
      }
      var seen = new Set();
      return arr.filter(function (f) {
        var k = f.name + '_' + f.size;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
    }

    fileInput.addEventListener('change', function (e) {
      state.files = collectFiles(e.target.files);
      setSummary();
      if (state.files.length === 0) toast('未检测到图片文件', 'error');
    });

    if (drop) {
      drop.addEventListener('click', function () { fileInput.click(); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = '#667eea'; }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = '#ccc'; }); });
      drop.addEventListener('drop', function (e) {
        var dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) state.files = collectFiles(dt.files);
        setSummary();
      });
    }

    function buildOutName(file) {
      var dot = file.name.lastIndexOf('.');
      var stem = dot > 0 ? file.name.slice(0, dot) : file.name;
      var ext = formatSel.value === 'png' ? 'png' : 'jpg';
      return stem + '_高清打印.' + ext;
    }

    function buildOpts() {
      return {
        mode: modeSel ? modeSel.value : 'text',
        scale: parseFloat(scaleSel ? scaleSel.value : '2') || 2.0,
        savePng: formatSel ? formatSel.value === 'png' : false,
        sauvolaK: parseFloat(sauvolaKIn ? sauvolaKIn.value : '0.15') || 0.15,
        noiseK: parseFloat(noiseKIn ? noiseKIn.value : '0.40') || 0.40,
        dotRecovery: dotRecoveryChk ? dotRecoveryChk.checked : true,
        jpegQuality: 95,
        maxSide: DEFAULTS.maxSide
      };
    }

    function runOne(file, opts, id) {
      if (worker && !state.workerBroken) {
        return new Promise(function (resolve) {
          resolvers[id] = resolve;
          try { worker.postMessage({ id: id, file: file, opts: opts }); }
          catch (e) { delete resolvers[id]; resolve({ ok: false, error: String(e) }); }
        });
      }
      if (global.PhotoEnhance && global.PhotoEnhance.processFile) {
        return global.PhotoEnhance.processFile(file, opts).then(function (r) {
          return { ok: true, blob: r.blob, w: r.w, h: r.h };
        }).catch(function (err) { return { ok: false, error: String((err && err.message) || err) }; });
      }
      return Promise.resolve({ ok: false, error: 'no processor' });
    }

    // ---- 结果预览 ----
    function addPreview(name, blob, w, h) {
      if (!previewEl) return;
      var url = URL.createObjectURL(blob);
      state.previews.push({ url: url, name: name });
      var fig = document.createElement('figure');
      fig.className = 'pe-thumb';
      var img = document.createElement('img');
      img.src = url; img.alt = name; img.loading = 'lazy';
      img.title = name + ' (' + w + 'x' + h + ') — 点击查看大图';
      var cap = document.createElement('figcaption');
      cap.textContent = name;
      fig.appendChild(img); fig.appendChild(cap);
      fig.addEventListener('click', function () { openLightbox(url, name); });
      previewEl.appendChild(fig);
    }
    function clearPreview() {
      state.previews.forEach(function (p) { try { URL.revokeObjectURL(p.url); } catch (e) {} });
      state.previews = [];
      if (previewEl) previewEl.innerHTML = '';
    }
    function openLightbox(url, name) {
      if (!lightbox) return;
      lightboxImg.src = url; lightboxImg.alt = name || '';
      lightbox.style.display = 'flex';
      lightbox.setAttribute('aria-hidden', 'false');
    }
    function closeLightbox() {
      if (!lightbox) return;
      lightbox.style.display = 'none';
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
    }
    if (lightbox) {
      lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target === lightboxClose) closeLightbox(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
    }

    function start() {
      if (state.files.length === 0) { toast('请先选择图片文件夹 / 文件', 'error'); return; }
      state.cancelled = false;
      state.processed = 0; state.failed = 0; state.log = [];
      clearPreview();
      state.zip = new JSZip();
      startBtn.disabled = true; cancelBtn.disabled = false; downloadBtn.disabled = true;
      progress.value = 0; progress.style.display = 'block';
      resultEl.value = '';
      failedEl.style.display = 'none';
      var opts = buildOpts();
      toast('开始处理 ' + state.files.length + ' 张图片...', 'success');
      if (worker) toast('处理在后台线程进行，界面可正常操作', 'success');

      var i = 0;
      function next() {
        if (state.cancelled) { finish(true); return; }
        if (i >= state.files.length) { finish(false); return; }
        var file = state.files[i];
        var idx = i;
        runOne(file, opts, idx).then(function (d) {
          var name = buildOutName(file);
          if (d.ok) {
            state.zip.file(name, d.blob);
            state.processed++;
            addPreview(name, d.blob, d.w, d.h);
            state.log.push('【' + file.name + '】 -> ' + name + ' (' + d.w + 'x' + d.h + ')');
          } else {
            state.failed++;
            state.log.push('【' + file.name + '】 处理失败: ' + d.error);
          }
          i++;
          progress.value = Math.round(i / state.files.length * 100);
          setTimeout(next, 0);
        }).catch(function (err) {
          state.failed++;
          state.log.push('【' + file.name + '】 处理失败: ' + String(err));
          i++;
          progress.value = Math.round(i / state.files.length * 100);
          setTimeout(next, 0);
        });
      }
      next();
    }

    function finish(cancelled) {
      startBtn.disabled = false; cancelBtn.disabled = true;
      var total = state.files.length;
      summaryEl.textContent = '完成：共 ' + total + ' 张，成功 ' + state.processed + ' 张，失败 ' + state.failed + ' 张' + (cancelled ? '（已取消）' : '');
      resultEl.value = state.log.join('\n');
      if (state.failed > 0) {
        failedEl.style.display = 'block';
        failedEl.textContent = '有 ' + state.failed + ' 张处理失败，详见结果区。';
      } else {
        failedEl.style.display = 'none';
      }
      if (state.processed > 0) {
        downloadBtn.disabled = false;
        toast('处理完成，可下载 ZIP' + (state.previews.length ? '；下方可预览' : ''), 'success');
      } else {
        downloadBtn.disabled = true;
        toast('没有成功处理的图片', 'error');
      }
    }

    function download() {
      if (!state.zip || state.processed === 0) return;
      var ts = new Date();
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var base = '拍照强化打印_结果_' + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + '_' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());
      toast('正在打包 ZIP...', 'success');
      state.zip.generateAsync({ type: 'blob' }).then(function (content) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = base + '.zip';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      });
    }

    function clearAll() {
      state.files = []; state.zip = null; state.processed = 0; state.failed = 0; state.log = []; state.cancelled = false;
      fileInput.value = '';
      progress.value = 0; progress.style.display = 'none';
      summaryEl.textContent = '当前合计：0 张图片';
      resultEl.value = '';
      failedEl.style.display = 'none';
      downloadBtn.disabled = true;
      startBtn.disabled = false; cancelBtn.disabled = true;
      clearPreview();
      toast('已清空', 'success');
    }

    startBtn.addEventListener('click', start);
    cancelBtn.addEventListener('click', function () { state.cancelled = true; });
    downloadBtn.addEventListener('click', download);
    clearBtn.addEventListener('click', clearAll);

    setSummary();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPhotoEnhanceTool);
    else initPhotoEnhanceTool();
  }
})(typeof window !== 'undefined' ? window : this);
