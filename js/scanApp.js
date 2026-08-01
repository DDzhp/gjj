/**
 * 批量扫描件处理工具 —— 主控制器
 * 负责：文件收集、任务队列调度、双方案并排渲染、批量打包下载
 */
(function () {
  'use strict';

  const MAX_EDGE = 2200;        // 处理时的最长边上限，防止大图卡死
  const THUMB_EDGE = 420;       // 列表缩略图尺寸
  const ACCEPT = /\.(jpe?g|png|bmp|webp|gif|tiff?)$/i;

  /** @type {Array<{id,name,file,url,image,thumb,resultA,resultB,status}>} */
  let items = [];
  let seq = 0;
  let processing = false;
  let opencvState = 'loading';  // loading | ready | failed

  const $ = (id) => document.getElementById(id);

  const el = {
    dropzone: $('dropzone'),
    fileInput: $('fileInput'),
    dirInput: $('dirInput'),
    pickFiles: $('pickFiles'),
    pickDir: $('pickDir'),
    list: $('list'),
    empty: $('empty'),
    count: $('count'),
    runBtn: $('runBtn'),
    clearBtn: $('clearBtn'),
    dlA: $('dlA'),
    dlB: $('dlB'),
    progress: $('progress'),
    progressBar: $('progressBar'),
    progressText: $('progressText'),
    cvStatus: $('cvStatus'),
    cvRetry: $('cvRetry'),
    cvHelp: $('cvHelp'),
    mode: $('mode'),
    blockSize: $('blockSize'),
    blockSizeVal: $('blockSizeVal'),
    threshC: $('threshC'),
    threshCVal: $('threshCVal'),
    denoise: $('denoise'),
    denoiseVal: $('denoiseVal'),
    removeChroma: $('removeChroma'),
    normalize: $('normalize'),
    autoCrop: $('autoCrop'),
    format: $('format')
  };

  /* ── 参数读取 ───────────────────────────────────────────────────────────── */
  function readOptions() {
    return {
      mode: el.mode.value,
      blockSize: parseInt(el.blockSize.value, 10),   // 0 = 自动
      C: parseInt(el.threshC.value, 10),
      denoise: parseInt(el.denoise.value, 10),
      removeChroma: el.removeChroma.checked,
      chromaStrength: 42,
      normalize: el.normalize.checked,
      autoCrop: el.autoCrop.checked
    };
  }

  /* ── 文件收集 ───────────────────────────────────────────────────────────── */
  function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => ACCEPT.test(f.name));
    if (!files.length) {
      if (fileList.length) toast('未发现支持的图片格式');
      return;
    }
    // 按文件名自然排序，保证扫描页顺序正确
    files.sort((a, b) => (a.webkitRelativePath || a.name)
      .localeCompare(b.webkitRelativePath || b.name, 'zh-CN', { numeric: true }));

    files.forEach(file => {
      items.push({
        id: ++seq,
        name: file.name,
        path: file.webkitRelativePath || file.name,
        file,
        url: URL.createObjectURL(file),
        image: null,
        thumb: null,
        resultA: null,
        resultB: null,
        status: 'pending'
      });
    });
    render();
  }

  /**
   * 递归读取拖入的文件夹（webkitGetAsEntry API）
   */
  function readEntry(entry, out) {
    return new Promise(resolve => {
      if (entry.isFile) {
        entry.file(file => {
          // 保留相对路径信息便于排序
          if (!file.webkitRelativePath) {
            try {
              Object.defineProperty(file, 'webkitRelativePath',
                { value: entry.fullPath.replace(/^\//, '') });
            } catch (e) { /* 某些浏览器只读，忽略 */ }
          }
          out.push(file);
          resolve();
        }, resolve);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const all = [];
        // readEntries 每次最多返回 100 条，必须循环读取直到返回空数组
        const readBatch = () => {
          reader.readEntries(async entries => {
            if (!entries.length) {
              await Promise.all(all.map(e => readEntry(e, out)));
              return resolve();
            }
            all.push(...entries);
            readBatch();
          }, resolve);
        };
        readBatch();
      } else {
        resolve();
      }
    });
  }

  async function handleDrop(dataTransfer) {
    const out = [];
    const dtItems = dataTransfer.items;
    if (dtItems && dtItems.length && dtItems[0].webkitGetAsEntry) {
      const entries = [];
      for (let i = 0; i < dtItems.length; i++) {
        const entry = dtItems[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      await Promise.all(entries.map(e => readEntry(e, out)));
    }
    addFiles(out.length ? out : dataTransfer.files);
  }

  /* ── 图片加载与缩放 ─────────────────────────────────────────────────────── */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = url;
    });
  }

  function toCanvas(img, maxEdge) {
    let { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  function canvasToBlob(canvas, format) {
    const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return new Promise(resolve => canvas.toBlob(resolve, type, 0.92));
  }

  /* ── 单张处理 ───────────────────────────────────────────────────────────── */
  async function processItem(item, opts) {
    if (!item.image) item.image = await loadImage(item.url);

    const srcCanvas = toCanvas(item.image, MAX_EDGE);
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });

    // ── 方案 A ──
    try {
      const imageData = ctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const resultData = EngineA.process(imageData, opts);

      const canvasA = document.createElement('canvas');
      canvasA.width = resultData.width;
      canvasA.height = resultData.height;
      canvasA.getContext('2d').putImageData(resultData, 0, 0);

      item.resultA = { canvas: canvasA, error: null, note: '' };
    } catch (err) {
      item.resultA = { canvas: null, error: err.message, note: '' };
    }

    // ── 方案 B ──
    if (EngineB.isReady()) {
      try {
        const res = EngineB.process(srcCanvas, opts);
        item.resultB = {
          canvas: res.canvas,
          error: null,
          note: res.cropped ? '已检测纸张并透视校正' : '未检出纸张边界，仅做增强'
        };
      } catch (err) {
        item.resultB = { canvas: null, error: err.message, note: '' };
      }
    } else {
      item.resultB = {
        canvas: null,
        error: opencvState === 'loading'
          ? 'OpenCV.js 仍在加载，请稍后重新处理'
          : 'OpenCV.js 未加载成功，详见页面顶部说明',
        note: ''
      };
    }

    item.status = 'done';
  }

  /* ── 批量执行 ───────────────────────────────────────────────────────────── */
  async function runAll() {
    if (processing || !items.length) return;
    processing = true;
    updateControls();

    const opts = readOptions();
    el.progress.hidden = false;

    // OpenCV 还在加载时先等一会儿，否则这一批的方案 B 会全部标记失败。
    // 等不到也不阻塞，方案 A 照常输出。
    if (opencvState === 'loading') {
      setProgress(0, items.length, '等待 OpenCV.js 就绪…');
      try {
        await Promise.race([
          EngineB.waitForOpenCV(90000),
          new Promise((_, rej) => setTimeout(() => rej(new Error('等待超时')), 20000))
        ]);
      } catch (e) {
        toast('OpenCV 暂未就绪，本轮先只出方案 A 的结果');
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      item.status = 'processing';
      updateRow(item);
      setProgress(i, items.length, item.name);

      try {
        await processItem(item, opts);
      } catch (err) {
        item.status = 'error';
        item.error = err.message;
      }
      updateRow(item);
      // 让出主线程，保证进度条与预览能实时刷新
      await new Promise(r => setTimeout(r, 0));
    }

    setProgress(items.length, items.length, '完成');
    processing = false;
    updateControls();
    setTimeout(() => { el.progress.hidden = true; }, 1200);
  }

  function setProgress(done, total, label) {
    const pct = total ? Math.round(done / total * 100) : 0;
    el.progressBar.style.width = pct + '%';
    el.progressText.textContent = `${done}/${total} · ${label}`;
  }

  /* ── 渲染 ───────────────────────────────────────────────────────────────── */
  function render() {
    el.count.textContent = items.length;
    el.empty.hidden = items.length > 0;
    el.list.innerHTML = '';
    items.forEach(item => el.list.appendChild(buildRow(item)));
    updateControls();
  }

  function buildRow(item) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = item.id;

    row.innerHTML = `
      <div class="row-head">
        <span class="row-name" title="${escapeHtml(item.path)}">${escapeHtml(item.name)}</span>
        <span class="badge" data-role="status">等待处理</span>
        <button class="icon-btn" data-role="remove" title="移除">✕</button>
      </div>
      <div class="panes">
        <figure class="pane">
          <figcaption>原图</figcaption>
          <div class="canvas-box" data-role="src"></div>
        </figure>
        <figure class="pane">
          <figcaption>
            <span class="tag tag-a">方案 A</span> DocScanner 算法
            <button class="link-btn" data-role="save-a" hidden>下载</button>
          </figcaption>
          <div class="canvas-box" data-role="a"><span class="ph">未处理</span></div>
          <p class="note" data-role="note-a"></p>
        </figure>
        <figure class="pane">
          <figcaption>
            <span class="tag tag-b">方案 B</span> jscanify 算法
            <button class="link-btn" data-role="save-b" hidden>下载</button>
          </figcaption>
          <div class="canvas-box" data-role="b"><span class="ph">未处理</span></div>
          <p class="note" data-role="note-b"></p>
        </figure>
      </div>`;

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    row.querySelector('[data-role="src"]').appendChild(img);

    row.querySelector('[data-role="remove"]').addEventListener('click', () => {
      URL.revokeObjectURL(item.url);
      items = items.filter(x => x.id !== item.id);
      render();
    });
    row.querySelector('[data-role="save-a"]').addEventListener('click',
      () => saveSingle(item, 'A'));
    row.querySelector('[data-role="save-b"]').addEventListener('click',
      () => saveSingle(item, 'B'));

    return row;
  }

  function updateRow(item) {
    const row = el.list.querySelector(`.row[data-id="${item.id}"]`);
    if (!row) return;

    const badge = row.querySelector('[data-role="status"]');
    const map = {
      pending: ['等待处理', ''],
      processing: ['处理中…', 'badge-run'],
      done: ['已完成', 'badge-ok'],
      error: ['失败', 'badge-err']
    };
    const [text, cls] = map[item.status] || map.pending;
    badge.textContent = text;
    badge.className = 'badge ' + cls;

    paint(row, 'a', item.resultA, item, 'A');
    paint(row, 'b', item.resultB, item, 'B');
  }

  function paint(row, role, result, item, key) {
    const box = row.querySelector(`[data-role="${role}"]`);
    const note = row.querySelector(`[data-role="note-${role}"]`);
    const saveBtn = row.querySelector(`[data-role="save-${role}"]`);
    if (!result) return;

    box.innerHTML = '';
    if (result.error) {
      box.innerHTML = `<span class="ph err">${escapeHtml(result.error)}</span>`;
      note.textContent = '';
      saveBtn.hidden = true;
      return;
    }

    // 预览用缩略图，避免把 2200px 的 canvas 全塞进 DOM
    const preview = downscale(result.canvas, THUMB_EDGE * 2);
    preview.className = 'preview';
    preview.addEventListener('click', () => openLightbox(result.canvas, item.name, key));
    box.appendChild(preview);

    note.textContent = result.note || '';
    saveBtn.hidden = false;
  }

  function downscale(canvas, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
    if (scale === 1) {
      const clone = document.createElement('canvas');
      clone.width = canvas.width;
      clone.height = canvas.height;
      clone.getContext('2d').drawImage(canvas, 0, 0);
      return clone;
    }
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  /* ── 大图查看 ───────────────────────────────────────────────────────────── */
  function openLightbox(canvas, name, key) {
    const mask = document.createElement('div');
    mask.className = 'lightbox';
    const clone = downscale(canvas, 2000);
    clone.className = 'lightbox-img';
    const cap = document.createElement('div');
    cap.className = 'lightbox-cap';
    cap.textContent = `${name} · 方案 ${key} · ${canvas.width}×${canvas.height}`;
    mask.appendChild(clone);
    mask.appendChild(cap);
    mask.addEventListener('click', () => mask.remove());
    document.body.appendChild(mask);
  }

  /* ── 下载 ───────────────────────────────────────────────────────────────── */
  function baseName(name) {
    return name.replace(/\.[^.]+$/, '');
  }

  async function saveSingle(item, key) {
    const result = key === 'A' ? item.resultA : item.resultB;
    if (!result || !result.canvas) return;
    const format = el.format.value;
    const blob = await canvasToBlob(result.canvas, format);
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    triggerDownload(blob, `${baseName(item.name)}_方案${key}.${ext}`);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadZip(key) {
    const done = items.filter(it => {
      const r = key === 'A' ? it.resultA : it.resultB;
      return r && r.canvas;
    });
    if (!done.length) return toast('没有可下载的结果');

    const format = el.format.value;
    const ext = format === 'jpeg' ? 'jpg' : 'png';

    if (typeof JSZip === 'undefined') {
      // 无 JSZip 时退化为逐个下载
      toast('打包库未加载，改为逐张下载');
      for (const item of done) await saveSingle(item, key);
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder(`方案${key}_扫描件`);
    el.progress.hidden = false;

    for (let i = 0; i < done.length; i++) {
      const item = done[i];
      const r = key === 'A' ? item.resultA : item.resultB;
      setProgress(i, done.length, '打包 ' + item.name);
      const blob = await canvasToBlob(r.canvas, format);
      folder.file(`${baseName(item.name)}.${ext}`, blob);
      await new Promise(r2 => setTimeout(r2, 0));
    }

    setProgress(done.length, done.length, '生成压缩包…');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `扫描件_方案${key}_${stamp()}.zip`);
    el.progress.hidden = true;
  }

  function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  /* ── 辅助 ───────────────────────────────────────────────────────────────── */
  function updateControls() {
    const hasItems = items.length > 0;
    el.runBtn.disabled = !hasItems || processing;
    el.clearBtn.disabled = !hasItems || processing;
    el.runBtn.textContent = processing ? '处理中…' : '开始处理';

    const hasA = items.some(i => i.resultA && i.resultA.canvas);
    const hasB = items.some(i => i.resultB && i.resultB.canvas);
    el.dlA.disabled = !hasA || processing;
    el.dlB.disabled = !hasB || processing;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let toastTimer;
  function toast(msg) {
    let box = document.querySelector('.toast');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
  }

  function setCvStatus(state, text) {
    opencvState = state;
    el.cvStatus.className = 'cv-status cv-' + state;
    el.cvStatus.textContent = text;
  }

  /* ── 事件绑定 ───────────────────────────────────────────────────────────── */
  function bind() {
    el.pickFiles.addEventListener('click', () => el.fileInput.click());
    el.pickDir.addEventListener('click', () => el.dirInput.click());

    el.fileInput.addEventListener('change', e => {
      addFiles(e.target.files); e.target.value = '';
    });
    el.dirInput.addEventListener('change', e => {
      addFiles(e.target.files); e.target.value = '';
    });

    ['dragenter', 'dragover'].forEach(evt =>
      el.dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        el.dropzone.classList.add('hover');
      }));
    ['dragleave', 'drop'].forEach(evt =>
      el.dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        if (evt === 'dragleave' && el.dropzone.contains(e.relatedTarget)) return;
        el.dropzone.classList.remove('hover');
      }));
    el.dropzone.addEventListener('drop', e => handleDrop(e.dataTransfer));

    // 阻止浏览器默认打开图片
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    el.runBtn.addEventListener('click', runAll);
    el.clearBtn.addEventListener('click', () => {
      items.forEach(i => URL.revokeObjectURL(i.url));
      items = [];
      render();
    });
    el.dlA.addEventListener('click', () => downloadZip('A'));
    el.dlB.addEventListener('click', () => downloadZip('B'));
    el.cvRetry.addEventListener('click', loadOpenCV);

    // 滑块数值联动
    const sync = (input, out, fmt) => {
      const upd = () => out.textContent = fmt ? fmt(input.value) : input.value;
      input.addEventListener('input', upd);
      upd();
    };
    sync(el.blockSize, el.blockSizeVal, v => v === '0' ? '自动' : v);
    sync(el.threshC, el.threshCVal);
    sync(el.denoise, el.denoiseVal, v => ['关闭', '标准', '强'][v] || v);

    // 灰度模式下阈值参数无意义，禁用以减少误操作
    el.mode.addEventListener('change', () => {
      const isGray = el.mode.value === 'gray';
      el.blockSize.disabled = isGray;
      el.threshC.disabled = isGray;
    });
  }

  /* ── 启动 ───────────────────────────────────────────────────────────────── */
  function loadOpenCV() {
    el.cvRetry.hidden = true;
    el.cvHelp.hidden = true;
    setCvStatus('loading', '方案 B：正在加载 OpenCV.js…');

    EngineB.waitForOpenCV(90000, msg => setCvStatus('loading', '方案 B：' + msg))
      .then(() => {
        setCvStatus('ready', '方案 B：OpenCV.js 已就绪');
        el.cvRetry.hidden = true;
        el.cvHelp.hidden = true;
        // 之前因为 OpenCV 缺席而跳过方案 B 的图，现在可以补算
        const pending = items.filter(it =>
          it.resultB && !it.resultB.canvas && it.status === 'done');
        if (pending.length) {
          toast(`OpenCV 已就绪，可重新点「开始处理」补齐 ${pending.length} 张的方案 B`);
        }
      })
      .catch(err => {
        const isFile = location.protocol === 'file:';
        setCvStatus('failed', isFile
          ? '方案 B：OpenCV.js 加载失败 —— 当前是 file:// 直开，浏览器拦截了外部脚本'
          : '方案 B：OpenCV.js 加载失败，方案 A 不受影响仍可正常使用');
        el.cvRetry.hidden = false;
        el.cvHelp.hidden = false;
        console.warn('[OpenCV] 全部源均加载失败：', err.message);
      });
  }

  function init() {
    bind();
    render();
    loadOpenCV();
  }

  // 由工具集外壳在首次切换到本工具时调用（面板默认隐藏，需确保 DOM 已就绪）
  window.ScanApp = { init };
})();
