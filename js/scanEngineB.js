/**
 * 方案 B —— jscanify 扫描优化逻辑（基于 OpenCV.js）
 * 参考：https://www.npmjs.com/package/jscanify   (v1.4.0, MIT, ColonelParrot)
 *
 * jscanify 原始链路（src/jscanify.js）：
 *   findPaperContour:  Canny(50,200) -> GaussianBlur(3x3) -> threshold(OTSU)
 *                      -> findContours(RETR_CCOMP) -> 取最大面积轮廓
 *   getCornerPoints:   minAreaRect 求中心 -> 按四象限分类轮廓点
 *                      -> 每象限取离中心最远的点
 *   extractPaper:      getPerspectiveTransform + warpPerspective
 *
 * 本文件完整复刻上述三个方法，并在透视校正之后接一段「打印增强」，
 * 使其输出可直接用于黑白打印。
 */
(function (global) {
  'use strict';

  let cvReady = false;
  let loadPromise = null;

  /**
   * OpenCV.js 的候选源，按顺序尝试。
   *
   * 注意：官方的 https://docs.opencv.org/<ver>/opencv.js 会对跨站引用返回
   * 403 Forbidden（禁止外链），不能直接用作 CDN，这正是之前「一直加载中 →
   * 不可用」的根因。这里改用 npm 镜像，并把本地副本排在第一位。
   *
   * 想彻底离线：把 opencv.js 下载到 vendor/opencv.js 即可，
   * 首项命中后就不会再走网络。
   */
  const CV_SOURCES = [
    'vendor/opencv.js',
    'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
    'https://unpkg.com/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
    'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js'
  ];

  function isReady() {
    return cvReady && typeof cv !== 'undefined' && !!cv.Mat;
  }

  /**
   * 等待 OpenCV 的 WASM 运行时真正初始化完毕。
   *
   * 不能只判断 `cv.Mat` 是否存在：opencv.js 在 WASM 编译完成前就会先把
   * 一个「未就绪」的 Module 对象挂到 window.cv 上，此时轮询可能提前通过，
   * 随后调用 cv.imread 就会抛错。官方约定的就绪信号是
   * onRuntimeInitialized 回调；较新的构建则把 cv 暴露成 thenable。
   */
  function whenRuntimeReady(timeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        cvReady = true;
        resolve();
      };

      const attach = () => {
        if (typeof cv === 'undefined') return false;

        // 形式一：cv 是 thenable（@techstark/opencv-js 等打包版本）。
        // 注意这是 Emscripten 自造的 then，**不是标准 Promise**：
        // 它的返回值是普通对象，没有 .catch，直接链式调用会抛 TypeError
        // 并把整个加载流程带崩。所以只传回调，错误交给下面的超时轮询兜底。
        if (typeof cv.then === 'function') {
          try {
            cv.then(mod => {
              // 有些构建 resolve 出来的才是真正可用的模块对象
              if (mod && mod.Mat) global.cv = mod;
              done();
            });
          } catch (e) {
            return false;   // 退回轮询
          }
          return true;
        }

        // 形式二：运行时已经初始化完成
        if (cv.Mat) { done(); return true; }

        // 形式三：挂回调等待 WASM 编译结束
        if (typeof cv.onRuntimeInitialized !== 'undefined' || cv.calledRun === false) {
          const prev = cv.onRuntimeInitialized;
          cv.onRuntimeInitialized = () => {
            if (typeof prev === 'function') { try { prev(); } catch (e) { /* ignore */ } }
            done();
          };
          return true;
        }
        return false;
      };

      attach();

      // 兜底轮询：覆盖 attach 时机过早、以及回调未被触发的构建差异
      const timer = setInterval(() => {
        if (settled) { clearInterval(timer); return; }
        if (typeof cv !== 'undefined' && cv.Mat) {
          clearInterval(timer);
          done();
        } else if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error('OpenCV.js 运行时初始化超时'));
        } else {
          attach();
        }
      }, 150);
    });
  }

  /** 动态插入 script 标签，加载单个源 */
  function loadScript(url, timeout) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      let timer = setTimeout(() => {
        s.onerror = s.onload = null;
        s.remove();
        reject(new Error('下载超时'));
      }, timeout);

      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => {
        clearTimeout(timer);
        s.remove();
        // file:// 下跨域脚本、以及 403/404 都会走到这里
        reject(new Error('无法下载（可能是网络受限或该源不可用）'));
      };
      document.head.appendChild(s);
    });
  }

  /**
   * 依次尝试各个源，任一成功即可。
   * @param {number} timeout 单个源的超时时间
   * @param {function} onProgress 状态回调，用于在界面上显示当前进度
   */
  function waitForOpenCV(timeout, onProgress) {
    if (loadPromise) return loadPromise;
    timeout = timeout || 90000;
    const report = typeof onProgress === 'function' ? onProgress : function () {};

    loadPromise = (async () => {
      if (isReady()) return;

      const errors = [];
      for (let i = 0; i < CV_SOURCES.length; i++) {
        const url = CV_SOURCES[i];
        const label = /^https?:/.test(url)
          ? url.replace(/^https:\/\/([^/]+).*$/, '$1')
          : '本地副本';
        try {
          report(`正在加载 OpenCV.js（源 ${i + 1}/${CV_SOURCES.length}：${label}）…`);
          await loadScript(url, timeout);
          report(`正在初始化 OpenCV 运行时（${label}）…`);
          await whenRuntimeReady(timeout);
          return;   // 成功
        } catch (err) {
          errors.push(`${label}: ${err.message}`);
          // 失败的源可能残留半初始化的 cv，清掉避免污染下一次尝试
          if (typeof cv !== 'undefined' && !cvReady) {
            try { delete global.cv; } catch (e) { global.cv = undefined; }
          }
        }
      }
      throw new Error(errors.join('；'));
    })();

    // 失败后允许用户点「重试」重新走一遍
    loadPromise.catch(() => { loadPromise = null; });
    return loadPromise;
  }

  /* ── jscanify: distance ─────────────────────────────────────────────────── */
  function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  /* ── jscanify: findPaperContour ─────────────────────────────────────────── */
  function findPaperContour(img) {
    const imgGray = new cv.Mat();
    cv.Canny(img, imgGray, 50, 200);

    const imgBlur = new cv.Mat();
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

    const imgThresh = new cv.Mat();
    cv.threshold(imgBlur, imgThresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(imgThresh, contours, hierarchy,
      cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let maxContourIndex = -1;
    for (let i = 0; i < contours.size(); i++) {
      const area = cv.contourArea(contours.get(i));
      if (area > maxArea) {
        maxArea = area;
        maxContourIndex = i;
      }
    }
    // 先克隆再释放容器，避免悬空引用（原库此处有生命周期隐患）
    const maxContour = maxContourIndex !== -1
      ? contours.get(maxContourIndex).clone()
      : null;

    imgGray.delete();
    imgBlur.delete();
    imgThresh.delete();
    contours.delete();
    hierarchy.delete();

    return { contour: maxContour, area: maxArea };
  }

  /* ── jscanify: getCornerPoints ──────────────────────────────────────────── */
  function getCornerPoints(contour) {
    const rect = cv.minAreaRect(contour);
    const center = rect.center;

    let topLeftCorner, topLeftCornerDist = 0;
    let topRightCorner, topRightCornerDist = 0;
    let bottomLeftCorner, bottomLeftCornerDist = 0;
    let bottomRightCorner, bottomRightCornerDist = 0;

    for (let i = 0; i < contour.data32S.length; i += 2) {
      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] };
      const dist = distance(point, center);

      if (point.x < center.x && point.y < center.y) {
        if (dist > topLeftCornerDist) { topLeftCorner = point; topLeftCornerDist = dist; }
      } else if (point.x > center.x && point.y < center.y) {
        if (dist > topRightCornerDist) { topRightCorner = point; topRightCornerDist = dist; }
      } else if (point.x < center.x && point.y > center.y) {
        if (dist > bottomLeftCornerDist) { bottomLeftCorner = point; bottomLeftCornerDist = dist; }
      } else if (point.x > center.x && point.y > center.y) {
        if (dist > bottomRightCornerDist) { bottomRightCorner = point; bottomRightCornerDist = dist; }
      }
    }
    return { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner };
  }

  /**
   * 判断检测到的四边形是否可信。
   * jscanify 原库不做校验，一旦拍摄背景复杂就会裁出错误区域，
   * 这里加一道门槛：四角齐全 + 覆盖面积足够 + 形状接近矩形。
   */
  function isQuadValid(corners, imgW, imgH, area) {
    const { topLeftCorner: tl, topRightCorner: tr,
            bottomLeftCorner: bl, bottomRightCorner: br } = corners;
    if (!tl || !tr || !bl || !br) return false;

    // 纸张至少要占画面的 15%
    if (area < imgW * imgH * 0.15) return false;

    const topW = distance(tl, tr);
    const bottomW = distance(bl, br);
    const leftH = distance(tl, bl);
    const rightH = distance(tr, br);
    if (topW < 20 || bottomW < 20 || leftH < 20 || rightH < 20) return false;

    // 对边长度不应相差过大（超过 40% 说明检测跑偏了）
    const wRatio = Math.min(topW, bottomW) / Math.max(topW, bottomW);
    const hRatio = Math.min(leftH, rightH) / Math.max(leftH, rightH);
    return wRatio > 0.6 && hRatio > 0.6;
  }

  /* ── jscanify: extractPaper（透视校正）──────────────────────────────────── */
  function warpToRect(src, corners) {
    const { topLeftCorner: tl, topRightCorner: tr,
            bottomLeftCorner: bl, bottomRightCorner: br } = corners;

    // 输出尺寸取对边最大值，保证不丢失细节
    const width = Math.round(Math.max(distance(tl, tr), distance(bl, br)));
    const height = Math.round(Math.max(distance(tl, bl), distance(tr, br)));

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, width, 0, 0, height, width, height
    ]);

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(width, height),
      cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));

    srcTri.delete();
    dstTri.delete();
    M.delete();
    return dst;
  }

  /**
   * 打印增强：在 jscanify 校正结果之上做黑白优化
   * 使用 OpenCV 原生的 adaptiveThreshold(GAUSSIAN_C)，
   * 与方案 A 的 MEAN_C 形成对照，这也是两套方案观感差异的主要来源。
   */
  function enhanceForPrint(src, opts) {
    const gray = new cv.Mat();
    // 4 通道转灰度
    if (src.channels() === 4) {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    } else if (src.channels() === 3) {
      cv.cvtColor(src, gray, cv.COLOR_RGB2GRAY);
    } else {
      src.copyTo(gray);
    }

    // 中值滤波：去掉彩色噪点转灰后残留的椒盐点
    if (opts.denoise > 0) {
      const tmp = new cv.Mat();
      cv.medianBlur(gray, tmp, 3);
      tmp.copyTo(gray);
      tmp.delete();
    }

    const out = new cv.Mat();
    if (opts.mode === 'gray') {
      // CLAHE 限制对比度自适应直方图均衡，纸张底色更均匀
      const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
      clahe.apply(gray, out);
      clahe.delete();
    } else {
      let blockSize = opts.blockSize;
      if (!blockSize) {
        blockSize = Math.max(11, Math.round(Math.min(src.cols, src.rows) * 0.015));
      }
      if (blockSize % 2 === 0) blockSize++;

      cv.adaptiveThreshold(gray, out, 255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY,
        blockSize, opts.C);

      // 形态学开运算，清除孤立噪点，保持笔画连续
      if (opts.denoise > 1) {
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        const morph = new cv.Mat();
        cv.morphologyEx(out, morph, cv.MORPH_OPEN, kernel);
        morph.copyTo(out);
        kernel.delete();
        morph.delete();
      }
    }

    gray.delete();
    return out;
  }

  /**
   * 主入口
   * @param {HTMLCanvasElement} sourceCanvas 承载原图的 canvas
   * @param {Object} options 处理参数
   * @returns {{canvas: HTMLCanvasElement, cropped: boolean}}
   */
  function process(sourceCanvas, options) {
    const opts = Object.assign({
      mode: 'bw',
      blockSize: 0,
      C: 12,
      autoCrop: true,   // 是否启用 jscanify 的纸张检测 + 透视校正
      denoise: 1
    }, options || {});

    if (!isReady()) throw new Error('OpenCV.js 尚未就绪');

    const src = cv.imread(sourceCanvas);
    let working = src;
    let cropped = false;
    let ownWorking = false;

    try {
      if (opts.autoCrop) {
        const { contour, area } = findPaperContour(src);
        if (contour) {
          const corners = getCornerPoints(contour);
          if (isQuadValid(corners, src.cols, src.rows, area)) {
            working = warpToRect(src, corners);
            ownWorking = true;
            cropped = true;
          }
          contour.delete();
        }
      }

      const enhanced = enhanceForPrint(working, opts);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = enhanced.cols;
      outCanvas.height = enhanced.rows;
      cv.imshow(outCanvas, enhanced);
      enhanced.delete();

      return { canvas: outCanvas, cropped };
    } finally {
      // 保证任何分支下都释放 WASM 内存，否则批量处理必然 OOM
      if (ownWorking && working !== src) working.delete();
      src.delete();
    }
  }

  global.EngineB = { process, waitForOpenCV, isReady };
})(window);
