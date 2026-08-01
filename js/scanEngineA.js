/**
 * 方案 A —— DocScanner 核心算法移植（纯 Canvas 实现，零依赖）
 * 参考：https://github.com/Nat30/nat30.github.io  (js/cv-engine.js)
 *
 * 原项目关键链路：
 *   cvtColor(COLOR_RGBA2GRAY)  ->  adaptiveThreshold(blockSize=11, C=2)
 *
 * 本文件用原生 Canvas + 积分图复刻同一套数学过程，因此无需加载 9MB 的
 * OpenCV.js，纯离线可用。为了适配「打印扫描件」场景，在原算法基础上补充了
 * 三个工程增强：光照均衡、杂色抑制、椒盐噪点清理。
 */
(function (global) {
  'use strict';

  /* ── 1. 灰度化 ────────────────────────────────────────────────────────────
   * 对应 cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY)
   * OpenCV 的 RGBA2GRAY 使用 ITU-R BT.601 亮度权重：
   *     Y = 0.299 R + 0.587 G + 0.114 B
   * 这里额外做「去杂色」：彩色印章/蓝色圆珠笔/纸张泛黄在打印时是噪声，
   * 通过饱和度判定把高饱和低明度的像素直接拉向纯白，避免它们变成灰块。
   */
  function toGray(imageData, opts) {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    const killChroma = opts.removeChroma;
    // 饱和度阈值：0~255，越大越宽容
    const satLimit = opts.chromaStrength;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];

      // BT.601 亮度
      let y = (r * 299 + g * 587 + b * 114) / 1000;

      if (killChroma) {
        const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
        const sat = max - min;               // 简化饱和度
        // 只依据饱和度判定，不看明暗：
        // 黑/灰/深灰的文字饱和度天然接近 0，不会被误伤；
        // 而印章、荧光笔、蓝色签字笔即使很深也是高饱和，必须去掉。
        // （早期版本加了 y > 90 的亮度限制，导致深色印章无法被去除）
        if (sat > satLimit) {
          // 按超出程度平滑地推向白色，避免硬切造成锯齿
          const push = Math.min(1, (sat - satLimit) / 40);
          y = y + (255 - y) * push;
        }
      }
      gray[p] = y;
    }
    return gray;
  }

  /* ── 2. 光照均衡（原项目未含，为打印效果补充）────────────────────────────
   * 手机拍照常见「一半亮一半暗」。做法是用超大半径均值模糊估计出background
   * 光照场，再用 原图/光照场 做除法归一化，把纸张底色拉回统一的白。
   * 使用积分图，复杂度 O(N)，与半径无关。
   */
  function buildIntegral(src, width, height) {
    // (width+1) * (height+1)，Float64 防止大图溢出
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      const rowOff = y * width;
      const intOff = (y + 1) * (width + 1);
      const intPrev = y * (width + 1);
      for (let x = 0; x < width; x++) {
        rowSum += src[rowOff + x];
        integral[intOff + x + 1] = integral[intPrev + x + 1] + rowSum;
      }
    }
    return integral;
  }

  // 借助积分图求任意矩形均值
  function boxMean(integral, width, height, cx, cy, radius) {
    const x1 = Math.max(0, cx - radius);
    const y1 = Math.max(0, cy - radius);
    const x2 = Math.min(width - 1, cx + radius);
    const y2 = Math.min(height - 1, cy + radius);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;
    const stride = width + 1;
    const sum =
      integral[(y2 + 1) * stride + (x2 + 1)] -
      integral[y1 * stride + (x2 + 1)] -
      integral[(y2 + 1) * stride + x1] +
      integral[y1 * stride + x1];
    return sum / (w * h);
  }

  function normalizeIllumination(gray, width, height) {
    // 半径取图像短边的 1/8，足够跨过文字笔画、只留下光照趋势
    const radius = Math.max(15, Math.round(Math.min(width, height) / 8));
    const integral = buildIntegral(gray, width, height);
    const out = new Uint8ClampedArray(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bg = boxMean(integral, width, height, x, y, radius);
        const v = gray[y * width + x];
        // 除法归一化：像素相对于其局部背景的亮度比例
        out[y * width + x] = bg > 1 ? (v / bg) * 220 : v;
      }
    }
    return out;
  }

  /* ── 3. 自适应阈值 ────────────────────────────────────────────────────────
   * 对应 cv.adaptiveThreshold(src, dst, 255, ADAPTIVE_THRESH_MEAN_C,
   *                            THRESH_BINARY, blockSize=11, C=2)
   * OpenCV 定义：dst = src > mean(blockSize邻域) - C ? 255 : 0
   * 原项目 blockSize=11 是为屏幕预览调的，对高分辨率照片偏小会产生麻点，
   * 因此这里把 blockSize 做成可调参数（默认按图像尺寸自适应）。
   */
  /**
   * 全局 Otsu 阈值，用作自适应阈值的「保底」。
   * 单纯的自适应阈值有个固有缺陷：当窗口比笔画还窄时，粗笔画/色块内部的
   * 局部均值本身就是暗的，导致 v > mean - C 成立而把笔画内部判成白色，
   * 出现「空心字」。用 Otsu 求出全局明暗分界，凡是明显低于该分界的像素
   * 一律强制为黑，即可保住实心笔画，同时把处理不均匀光照的工作留给自适应部分。
   */
  function otsuThreshold(gray) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];

    let sumB = 0, wB = 0, maxVar = -1, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      // 类间方差
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; threshold = t; }
    }
    return threshold;
  }

  function adaptiveThreshold(gray, width, height, blockSize, C) {
    // OpenCV 要求 blockSize 为奇数
    if (blockSize % 2 === 0) blockSize += 1;
    const radius = (blockSize - 1) >> 1;
    const integral = buildIntegral(gray, width, height);
    const out = new Uint8ClampedArray(width * height);

    // 保底阈值：留一定余量，只强制那些「毫无疑问是墨迹」的像素
    const otsu = otsuThreshold(gray);
    const hardBlack = Math.max(0, otsu - 25);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const v = gray[idx];
        if (v <= hardBlack) {          // 明确的墨迹，直接判黑，防止空心
          out[idx] = 0;
          continue;
        }
        const mean = boxMean(integral, width, height, x, y, radius);
        out[idx] = v > mean - C ? 255 : 0;
      }
    }
    return out;
  }

  /* ── 4. 椒盐噪点清理（打印优化补充）──────────────────────────────────────
   * 二值图上做 3x3 多数表决：孤立的单个黑点（灰尘/传感器噪声）被抹掉，
   * 而成片的笔画因为邻居够多得以保留。这一步直接决定打印时是否「脏」。
   */
  function denoiseBinary(bin, width, height, passes) {
    let cur = bin;
    for (let p = 0; p < passes; p++) {
      const out = new Uint8ClampedArray(cur.length);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          // 边界像素不处理，直接沿用
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            out[idx] = cur[idx];
            continue;
          }
          let black = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (cur[(y + dy) * width + (x + dx)] === 0) black++;
            }
          }
          // 9 邻域中黑色 >= 5 判为黑，否则为白
          out[idx] = black >= 5 ? 0 : 255;
        }
      }
      cur = out;
    }
    return cur;
  }

  /* ── 5. 灰度输出模式的对比度拉伸 ──────────────────────────────────────────
   * 非二值模式下，用百分位裁剪把直方图拉满 0~255，纸张变纯白、字变纯黑。
   */
  function stretchContrast(gray, width, height) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    const total = gray.length;
    const cutLow = total * 0.01;    // 忽略最暗的 1%
    const cutHigh = total * 0.995;  // 忽略最亮的 0.5%

    let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= cutLow) { lo = i; break; }
    }
    acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= cutHigh) { hi = i; break; }
    }
    if (hi <= lo) { lo = 0; hi = 255; }

    const scale = 255 / (hi - lo);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = (i - lo) * scale;

    const out = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i++) out[i] = lut[gray[i]];
    return out;
  }

  /**
   * 主入口
   * @param {ImageData} imageData 原始像素
   * @param {Object} options 处理参数
   * @returns {ImageData} 处理结果
   */
  function process(imageData, options) {
    const opts = Object.assign({
      mode: 'bw',            // 'bw' 二值 | 'gray' 灰度
      blockSize: 0,          // 0 = 按图像尺寸自动
      C: 12,                 // 自适应阈值偏移，对应原项目的 C
      removeChroma: true,    // 去除彩色杂色
      chromaStrength: 42,    // 饱和度阈值
      normalize: true,       // 光照均衡
      denoise: 1             // 去噪迭代次数
    }, options || {});

    const { width, height } = imageData;

    // Step 1 灰度 + 去杂色
    let gray = toGray(imageData, opts);

    // Step 2 光照均衡
    if (opts.normalize) {
      gray = normalizeIllumination(gray, width, height);
    }

    let result;
    if (opts.mode === 'gray') {
      result = stretchContrast(gray, width, height);
    } else {
      // Step 3 自适应阈值
      let blockSize = opts.blockSize;
      if (!blockSize) {
        // 自动：取短边的 4%，且不小于 31。
        // 窗口必须明显大于笔画宽度，否则粗笔画内部会被判成背景（空心字）；
        // 原项目固定的 blockSize=11 只适合小尺寸预览图，这里按图放大。
        blockSize = Math.max(31, Math.round(Math.min(width, height) * 0.04));
        if (blockSize % 2 === 0) blockSize++;
      } else {
        // 手动值也要设下限，过小的窗口必然产生空心字
        blockSize = Math.max(9, blockSize);
      }
      result = adaptiveThreshold(gray, width, height, blockSize, opts.C);

      // Step 4 去噪
      if (opts.denoise > 0) {
        result = denoiseBinary(result, width, height, opts.denoise);
      }
    }

    // 写回 RGBA
    const out = new ImageData(width, height);
    const od = out.data;
    for (let i = 0, p = 0; p < result.length; i += 4, p++) {
      const v = result[p];
      od[i] = od[i + 1] = od[i + 2] = v;
      od[i + 3] = 255;
    }
    return out;
  }

  global.EngineA = { process };
})(window);
