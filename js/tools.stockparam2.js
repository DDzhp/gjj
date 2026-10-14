/* ============================================================
 * 🧪 入库参数生成器2（接口对比·调试版）
 * ------------------------------------------------------------
 * 用途：与 1 号「📦 入库参数生成器」并存的独立调试工具，用于对比
 *       不同云 OCR 接口的识别效果，互不影响、可随时对照。
 *
 * 云端渠道（经 SCF 云函数 cloud_ocr_scf.py 转发，密钥在云函数侧）：
 *   百度云  /ocr                通用文字识别（标准版 general_basic）
 *           /ocr_accurate       通用文字识别（高精度版 accurate_basic）
 *   腾讯云  /ocr_tencent            通用印刷体识别（标准 GeneralBasicOCR）
 *           /ocr_tencent_accurate   通用印刷体识别（高精度 GeneralAccurateOCR）
 *           /ocr_tencent_fast       通用印刷体识别（高速 GeneralFastOCR）
 *           /ocr_tencent_efficient  通用印刷体识别（精简 GeneralEfficientOCR）
 *           /ocr_tencent_handwriting 通用印刷体识别（手写 GeneralHandwritingOCR）
 *   ⚠️ 新端点需先把仓库根目录 cloud_ocr_scf.py 重新部署到腾讯云 SCF，
 *      否则新渠道会报「not found」/「非JSON」错误。
 *
 * 实现原理（零复制、零侵入）：
 *   1) 面板 DOM 是 1 号工具 section 的完整克隆，所有元素 id 加「2」后缀；
 *   2) 本文件对 document.getElementById 做「受白名单约束的上下文路由」：
 *      仅当 currentActiveTool === 'stockParamTool2' 且 id 在入库参数生成器
 *      的 id 白名单内时，优先解析为对应「2」号元素；其余情况完全走原逻辑。
 *      因此 1 号工具的全部业务函数（解析/回填/提取/转换/本地引擎）被
 *      原样复用，1 号工具的后续修复自动同步到 2 号，无重复代码分支；
 *   3) 云端渠道表扩展：包装 window.__CloudOCR.ocr，按引擎名分发到
 *      SCF 对应端点（老引擎名 tencent/baidu 行为与原来完全一致）。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. getElementById 上下文路由（白名单 = 入库参数生成器面板全部 id） ---------- */
  var STOCK_IDS = {
    // 图片识别区
    orderDropZone: 1, orderImageInput: 1, orderOcrChannel: 1,
    orderImagePreview: 1, orderImagePreviewWrap: 1,
    orderOcrStatus: 1, orderOcrText: 1, orderOcrTextWrap: 1, platformSelect: 1,
    // 一键转换 / 结果
    nonStandardData: 1, result: 1,
    // 参数表单
    motherboardModel: 1, systemType: 1, filterLifeType: 1,
    channel2Pulse: 1, channel1Pulse: 1, waterTime: 1,
    valve2Time: 1, valve1Time: 1, maintainTime: 1,
    rate1Hot: 1, rate2Cold: 1, rate1HotPerLiter: 1, rate2ColdPerLiter: 1,
    singleLimitFlow: 1, waterWaitTime: 1, waterPauseTime: 1,
    floatBall: 1, singleLimitTime: 1, cardFlow: 1,
    hotWaterTemp: 1, coolStartTemp: 1,
    tempLockDisinfectionWait: 1, disinfectionDuration: 1,
    iccidStart: 1, iccidEnd: 1, inStockCount: 1,
    // 数据粘贴区
    excelData: 1
  };
  var _geb = document.getElementById.bind(document);
  document.getElementById = function (id) {
    if (window.currentActiveTool === 'stockParamTool2' && STOCK_IDS[id]) {
      var el2 = _geb(id + '2');
      if (el2) return el2;
    }
    return _geb(id);
  };

  /* ---------- 2. 云端渠道表扩展（包装 __CloudOCR.ocr，按引擎名分发 SCF 端点） ---------- */
  var OCR_PATHS = {
    baidu: '/ocr',                          // 百度 通用文字识别（标准版）
    baidu_accurate: '/ocr_accurate',        // 百度 通用文字识别（高精度版）
    tencent: '/ocr_tencent',                // 腾讯 通用印刷体识别（标准）
    tencent_accurate: '/ocr_tencent_accurate',   // 腾讯 通用印刷体识别（高精度）
    tencent_fast: '/ocr_tencent_fast',           // 腾讯 通用印刷体识别（高速）
    tencent_efficient: '/ocr_tencent_efficient', // 腾讯 通用印刷体识别（精简）
    tencent_handwriting: '/ocr_tencent_handwriting' // 腾讯 通用印刷体识别（手写）
  };

  function scaled(canvas, maxDim) {
    var w = canvas.width, h = canvas.height;
    if (Math.max(w, h) <= maxDim) { return { cv: canvas, scale: 1 }; }
    var s = maxDim / Math.max(w, h);
    var c2 = document.createElement('canvas');
    c2.width = Math.round(w * s); c2.height = Math.round(h * s);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    return { cv: c2, scale: s };
  }

  function ocrViaPath(dataUrl, path, engineName) {
    var img = new Image();
    return new Promise(function (resolve, reject) {
      img.onload = function () {
        try {
          var cv = document.createElement('canvas');
          cv.width = img.width; cv.height = img.height;
          cv.getContext('2d').drawImage(img, 0, 0);
          var st = scaled(cv, 2400); // 与 1 号一致：大边 2400px 内再上传
          var b64 = st.cv.toDataURL('image/jpeg', 0.9).split(',')[1] || '';
          if (!b64) { reject(new Error('图片转码失败')); return; }
          fetch(window.__CloudOCR.proxyBase() + path, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: b64,
            mode: 'cors'
          }).then(function (r) {
            return r.text().then(function (t) {
              try { return JSON.parse(t); }
              catch (e) {
                throw new Error('代理返回异常内容(HTTP ' + r.status + '，非JSON)。' +
                  (path !== '/ocr' && path !== '/ocr_tencent'
                    ? '新接口需先更新部署 SCF 云函数（cloud_ocr_scf.py）后再试'
                    : '请检查云端代理地址'));
              }
            });
          }).then(function (data) {
            if (!data) { reject(new Error('云 OCR 无响应（代理未启动？）')); return; }
            if (data.error) {
              var msg = String(data.error);
              var isNew = path !== '/ocr' && path !== '/ocr_tencent'; // v4.3 新端点
              if (isNew && /not found/i.test(msg)) {
                reject(new Error('云端还没有该接口（' + msg + '）——SCF 云函数仍是旧版：请把 cloud_ocr_scf.py 全部内容重新部署到腾讯云 SCF（控制台→该函数→函数代码→粘贴覆盖 index.py→点「部署」），部署完成后再试本渠道'));
              } else if (isNew) {
                reject(new Error('云 OCR 错误：' + msg));
              } else {
                reject(new Error('云 OCR 错误：' + msg));
              }
              return;
            }
            resolve({ text: (data.text || '').trim(), engine: engineName });
          }).catch(reject);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  if (window.__CloudOCR && typeof window.__CloudOCR.ocr === 'function') {
    var _origOcr = window.__CloudOCR.ocr;
    window.__CloudOCR.ocr = function (dataUrl, engine) {
      if (OCR_PATHS[engine]) return ocrViaPath(dataUrl, OCR_PATHS[engine], engine);
      return _origOcr(dataUrl, engine); // 其余渠道保持原逻辑（含 both 分支调用的 tencent/baidu）
    };
  }

  /* ---------- 3. 2 号面板专属：截图粘贴 / 拖拽上传 / 渠道记忆 ---------- */
  document.addEventListener('paste', function (e) {
    if (window.currentActiveTool !== 'stockParamTool2') return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); handleOrderImageFile(f); } // 上下文路由自动落到 2 号面板
        break;
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init2);
  } else {
    init2();
  }

  function init2() {
    // 拖拽上传（与 1 号同规则，作用于 orderDropZone2）
    var zone = _geb('orderDropZone2');
    if (zone) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zone.style.background = '#eef6ff'; });
      });
      zone.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); zone.style.background = '#f8fbff'; });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation(); zone.style.background = '#f8fbff';
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) {
          if (window.currentActiveTool !== 'stockParamTool2') {
            if (window.showTool) window.showTool('stockParamTool2');
          }
          handleOrderImageFile(f);
        }
      });
    }
    // 渠道记忆（独立 key，不与 1 号互相覆盖）
    try {
      var chSaved = localStorage.getItem('stock_ocr_channel2');
      var sel = _geb('orderOcrChannel2');
      if (chSaved && sel) sel.value = chSaved;
    } catch (e) { }
  }
})();
