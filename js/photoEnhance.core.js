/*!
 * photoEnhance.core.js — 拍照强化图片打印处理（纯前端管线核心）
 * 移植自 Python 版 enhance_for_print.py（OpenCV 管线）：
 *   放大 -> 双边滤波 -> 中值滤波 -> 背景光照归一化 -> CLAHE -> USM 锐化
 *   -> 二值化(文字感知双k Sauvola / 单 Sauvola / 自适应 / Otsu / 白纸增强) -> 形态学开/闭
 * 同时可在三种环境运行：浏览器主线程、Web Worker(importScripts)、Node(测试 require)。
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    scale: 2.0,
    bgBlurKsize: 51,
    claheLimit: 2.0,
    claheGrid: 8,
    sharpenAmount: 0.8,
    binary: true,
    mode: 'text',          // text | sauvola | white | adaptive | otsu | gray
    sauvolaK: 0.15,
    noiseK: 0.40,
    textAware: true,
    dotRecovery: true,
    savePng: false,
    jpegQuality: 95,
    maxSide: 4000
  };

  function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v | 0); }

  function rgbaToGray(data, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    }
    return g;
  }

  // ---------- 双边滤波（半径=2 近似 d=5，颜色权重查表） ----------
  function bilateral(gray, w, h, radius, sigmaColor, sigmaSpace) {
    const out = new Float32Array(w * h);
    const sigC2 = 2 * sigmaColor * sigmaColor;
    const sigS2 = 2 * sigmaSpace * sigmaSpace;
    const span = 2 * radius + 1;
    const sw = new Float32Array(span * span);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        sw[(dy + radius) * span + (dx + radius)] = Math.exp(-(dx * dx + dy * dy) / sigS2);
    const cw = new Float32Array(511);
    for (let d = -255; d <= 255; d++) cw[d + 255] = Math.exp(-(d * d) / sigC2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ci = y * w + x;
        const center = gray[ci];
        let sumW = 0, sum = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          let yy = y + dy; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
          for (let dx = -radius; dx <= radius; dx++) {
            let xx = x + dx; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1;
            const val = gray[yy * w + xx];
            const dc = (val - center) | 0;
            const wgt = sw[(dy + radius) * span + (dx + radius)] * cw[dc + 255];
            sumW += wgt; sum += wgt * val;
          }
        }
        out[ci] = sum / sumW;
      }
    }
    return out;
  }

  // ---------- 可分离中值滤波（滑动直方图常数时间） ----------
  function medianFromHist(H, count) {
    let cum = 0;
    const mid = (count + 1) >> 1;
    for (let i = 0; i < 256; i++) { cum += H[i]; if (cum >= mid) return i; }
    return 255;
  }
  function median1D(gray, w, h, radius, horizontal) {
    const out = new Float32Array(w * h);
    const H = new Int32Array(256);
    if (horizontal) {
      for (let y = 0; y < h; y++) {
        H.fill(0);
        const base = y * w;
        const initTo = Math.min(w - 1, radius);
        for (let x = 0; x <= initTo; x++) H[gray[base + x] | 0]++;
        for (let x = 0; x < w; x++) {
          const cnt = (Math.min(w - 1, x + radius) - Math.max(0, x - radius) + 1);
          out[base + x] = medianFromHist(H, cnt);
          const addX = x + radius + 1; if (addX < w) H[gray[base + addX] | 0]++;
          const remX = x - radius; if (remX >= 0) H[gray[base + remX] | 0]--;
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        H.fill(0);
        const initTo = Math.min(h - 1, radius);
        for (let y = 0; y <= initTo; y++) H[gray[y * w + x] | 0]++;
        for (let y = 0; y < h; y++) {
          const cnt = (Math.min(h - 1, y + radius) - Math.max(0, y - radius) + 1);
          out[y * w + x] = medianFromHist(H, cnt);
          const addY = y + radius + 1; if (addY < h) H[gray[addY * w + x] | 0]++;
          const remY = y - radius; if (remY >= 0) H[gray[remY * w + x] | 0]--;
        }
      }
    }
    return out;
  }

  // ---------- 盒式模糊（3 次近似高斯） ----------
  function boxBlur(src, w, h, r, horizontal) {
    const tmp = new Float32Array(w * h);
    if (horizontal) {
      for (let y = 0; y < h; y++) {
        const base = y * w;
        for (let x = 0; x < w; x++) {
          let sum = 0, n = 0;
          for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { sum += src[base + xx]; n++; } }
          tmp[base + x] = sum / n;
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          let sum = 0, n = 0;
          for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { sum += src[yy * w + x]; n++; } }
          tmp[y * w + x] = sum / n;
        }
      }
    }
    return tmp;
  }
  function boxBlur3(src, w, h, r) {
    return boxBlur(boxBlur(boxBlur(src, w, h, r, true), w, h, r, false), w, h, r, true);
  }
  function gaussianBlur(src, w, h, ksize, sigma) {
    const r = Math.max(3, Math.round(ksize / 6));
    return boxBlur3(src, w, h, r);
  }

  // ---------- 背景光照归一化（白纸增强核心） ----------
  function backgroundNormalize(gray, w, h, ksize) {
    const inv = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) inv[i] = gray[i] + 1;
    const bg = gaussianBlur(inv, w, h, ksize, Math.max(ksize / 6, 9));
    const out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let v = inv[i] * 255.0 / bg[i];
      out[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    return out;
  }

  // ---------- CLAHE ----------
  function clahe(gray, w, h, tiles, clipLimit) {
    const out = new Float32Array(w * h);
    const gridX = tiles, gridY = tiles;
    const tileW = Math.ceil(w / gridX), tileH = Math.ceil(h / gridY);
    const luts = [];
    for (let ty = 0; ty < gridY; ty++) {
      for (let tx = 0; tx < gridX; tx++) {
        const hist = new Int32Array(256);
        const x0 = tx * tileW, y0 = ty * tileH;
        const x1 = Math.min(w, x0 + tileW), y1 = Math.min(h, y0 + tileH);
        let cnt = 0;
        for (let y = y0; y < y1; y++) {
          const base = y * w;
          for (let x = x0; x < x1; x++) { hist[gray[base + x] | 0]++; cnt++; }
        }
        const limit = Math.max(1, clipLimit * cnt / 256);
        let clipped = 0;
        for (let i = 0; i < 256; i++) { if (hist[i] > limit) { clipped += hist[i] - limit; hist[i] = limit; } }
        const redist = (clipped / 256) | 0;
        for (let i = 0; i < 256; i++) hist[i] += redist;
        const lut = new Float32Array(256);
        let cdf = 0, cdfMin = -1, nonzero = 0;
        for (let i = 0; i < 256; i++) { cdf += hist[i]; if (hist[i] > 0) { if (cdfMin < 0) cdfMin = cdf; nonzero++; } }
        if (nonzero <= 1) {
          for (let i = 0; i < 256; i++) lut[i] = i;
        } else {
          const denom = (cdf - cdfMin) || 1;
          let acc = 0;
          for (let i = 0; i < 256; i++) {
            acc += hist[i];
            let v = (acc - cdfMin) / denom * 255;
            lut[i] = (v < 0 ? 0 : (v > 255 ? 255 : Math.round(v)));
          }
        }
        luts.push(lut);
      }
    }
    const sx = (gridX > 1) ? (w - 1) / (gridX - 1) : 1;
    const sy = (gridY > 1) ? (h - 1) / (gridY - 1) : 1;
    for (let y = 0; y < h; y++) {
      const fy = (gridY > 1) ? y / sy : 0;
      let j0 = Math.floor(fy); let j1 = Math.min(j0 + 1, gridY - 1); let dy = fy - j0;
      const base = y * w;
      for (let x = 0; x < w; x++) {
        const fx = (gridX > 1) ? x / sx : 0;
        let i0 = Math.floor(fx); let i1 = Math.min(i0 + 1, gridX - 1); let dx = fx - i0;
        const v = gray[base + x] | 0;
        const l00 = luts[j0 * gridX + i0][v], l10 = luts[j0 * gridX + i1][v];
        const l01 = luts[j1 * gridX + i0][v], l11 = luts[j1 * gridX + i1][v];
        const top = l00 * (1 - dx) + l10 * dx;
        const bot = l01 * (1 - dx) + l11 * dx;
        out[base + x] = top * (1 - dy) + bot * dy;
      }
    }
    return out;
  }

  // ---------- USM ----------
  function usm(gray, w, h, sigma, amount) {
    const r = Math.max(1, Math.round(sigma));
    const blurred = boxBlur3(gray, w, h, r);
    const out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let v = gray[i] * (1 + amount) - blurred[i] * amount;
      out[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    return out;
  }

  // ---------- 盒式求和（Sauvola 均值/方差） ----------
  function boxSum(src, w, h, W) {
    const r = (W - 1) >> 1;
    const tmp = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      const base = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) { let xx = x < 0 ? 0 : (x >= w ? w - 1 : x); sum += src[base + xx]; }
      for (let x = 0; x < w; x++) {
        tmp[base + x] = sum;
        const xout = x - r, xin = x + r + 1;
        const vout = src[base + (xout < 0 ? 0 : xout)];
        const vin = src[base + (xin >= w ? w - 1 : xin)];
        sum += vin - vout;
      }
    }
    const out = new Float64Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) { let yy = y < 0 ? 0 : (y >= h ? h - 1 : y); sum += tmp[yy * w + x]; }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum;
        const yout = y - r, yin = y + r + 1;
        const vout = tmp[(yout < 0 ? 0 : yout) * w + x];
        const vin = tmp[(yin >= h ? h - 1 : yin) * w + x];
        sum += vin - vout;
      }
    }
    return out;
  }

  function sauvolaWindow(scale) {
    let w = (25 * scale) | 0;
    if (w < 15) w = 15;
    if (w % 2 === 0) w += 1;
    return w;
  }
  function adaptiveWindow(scale) {
    let b = (15 * scale) | 0;
    if (b < 11) b = 11;
    if (b % 2 === 0) b += 1;
    return b;
  }

  function sauvola(gray, w, h, W, k, R) {
    const r = (W - 1) >> 1;
    const sum = boxSum(gray, w, h, W);
    const gray2 = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) gray2[i] = gray[i] * gray[i];
    const sumSq = boxSum(gray2, w, h, W);
    const ones = new Float32Array(w * h); ones.fill(1);
    const count = boxSum(ones, w, h, W);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const mean = sum[i] / count[i];
      const varr = sumSq[i] / count[i] - mean * mean;
      const std = Math.sqrt(varr > 0 ? varr : 0);
      const T = mean * (1 + k * (std / R - 1));
      out[i] = gray[i] < T ? 0 : 255;
    }
    return out;
  }

  // ---------- 自适应高斯阈值（对标 OpenCV ADAPTIVE_THRESH_GAUSSIAN_C） ----------
  function adaptiveThreshold(gray, w, h, W, C) {
    const sum = boxSum(gray, w, h, W);
    const ones = new Float32Array(w * h); ones.fill(1);
    const count = boxSum(ones, w, h, W);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const mean = sum[i] / count[i];
      out[i] = gray[i] > (mean - C) ? 255 : 0;
    }
    return out;
  }

  // ---------- Otsu 全局阈值 ----------
  function otsuThreshold(gray, w, h) {
    const hist = new Int32Array(256);
    for (let i = 0; i < w * h; i++) hist[gray[i] | 0]++;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    const total = w * h;
    let sumB = 0, wB = 0, maxVar = -1, thr = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const vb = wB * wF * (mB - mF) * (mB - mF);
      if (vb > maxVar) { maxVar = vb; thr = t; }
    }
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = gray[i] < thr ? 0 : 255;
    return out;
  }

  // ---------- 形态学（3x3） ----------
  function dilate3(bin, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          if (bin[yy * w + xx] === 255) { hit = true; break; }
        }
      }
      if (hit) out[y * w + x] = 255;
    }
    return out;
  }
  function erode3(bin, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let all = true;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) { all = false; break; }
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) { all = false; break; }
          if (bin[yy * w + xx] !== 255) { all = false; break; }
        }
        if (!all) break;
      }
      if (all) out[y * w + x] = 255;
    }
    return out;
  }
  function morphology(bin, w, h, op, iter) {
    let cur = bin;
    for (let i = 0; i < iter; i++) cur = (op === 'open') ? erode3(cur, w, h) : dilate3(cur, w, h);
    for (let i = 0; i < iter; i++) cur = (op === 'open') ? dilate3(cur, w, h) : erode3(cur, w, h);
    return cur;
  }
  function dilate(bin, w, h, radius, iterations) {
    let cur = bin;
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (cur[y * w + x] === 255) { next[y * w + x] = 255; continue; }
        let hit = false;
        for (let dy = -radius; dy <= radius && !hit; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            if (cur[yy * w + xx] === 255) { hit = true; break; }
          }
        }
        if (hit) next[y * w + x] = 255;
      }
      cur = next;
    }
    return cur;
  }

  // ---------- 连通域分析（4 邻域已扫描方向 + 并查集；typed array，避免 Map） ----------
  function connectedComponents(bin, w, h) {
    const N = w * h;
    const labels = new Int32Array(N);   // 0 = 背景/未标号
    const parent = new Int32Array(N + 1);
    let nextLabel = 1;
    const find = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < N; i++) {
      if (bin[i] !== 255) continue;
      const x = i % w, y = (i / w) | 0;
      // 已扫描过的邻居：上、左上、左、右上
      const cand = [];
      if (y > 0 && bin[i - w] === 255) cand.push(i - w);
      if (y > 0 && x > 0 && bin[i - w - 1] === 255) cand.push(i - w - 1);
      if (x > 0 && bin[i - 1] === 255) cand.push(i - 1);
      if (y > 0 && x < w - 1 && bin[i - w + 1] === 255) cand.push(i - w + 1);
      if (cand.length === 0) {
        labels[i] = nextLabel; parent[nextLabel] = nextLabel; nextLabel++;
      } else {
        // 取邻居中的最小根作为代表，并把其余邻居并入
        let minLab = Infinity;
        for (let k = 0; k < cand.length; k++) { const r = find(labels[cand[k]]); if (r < minLab) minLab = r; }
        for (let k = 0; k < cand.length; k++) { const r = find(labels[cand[k]]); if (r !== minLab) parent[r] = minLab; }
        labels[i] = minLab;
      }
    }
    // 第二遍：路径压缩 + 统计（所有 1..count 编号都预置 stats，兼容调用方遍历）
    const stats = new Array(nextLabel);
    for (let i = 0; i < nextLabel; i++) stats[i] = { area: 0, x: 1e9, y: 1e9, x1: -1, y1: -1, cx: 0, cy: 0 };
    for (let i = 0; i < N; i++) {
      if (labels[i] === 0) continue;
      const root = find(labels[i]);
      labels[i] = root;
      const o = stats[root];
      o.area++;
      const x = i % w, y = (i / w) | 0;
      if (x < o.x) o.x = x; if (y < o.y) o.y = y;
      if (x > o.x1) o.x1 = x; if (y > o.y1) o.y1 = y;
      o.cx += x; o.cy += y;
    }
    for (let r = 1; r < nextLabel; r++) {
      const o = stats[r];
      if (o.area > 0) { o.w = o.x1 - o.x + 1; o.h = o.y1 - o.y + 1; o.cx /= o.area; o.cy /= o.area; }
    }
    return { labels, stats, count: nextLabel - 1 };
  }

  // ---------- 文字感知双k Sauvola 二值化（背景清理 CC 降至 0.5x） ----------
  function textAwareBinarize(sharpened, w, h, opts) {
    const W = sauvolaWindow(opts.scale);
    const low = sauvola(sharpened, w, h, W, opts.sauvolaK, 128);
    const high = sauvola(sharpened, w, h, W, opts.noiseK, 128);

    const as = 0.5, step = 1 / as;
    const aw = Math.max(1, (w * as) | 0), ah = Math.max(1, (h * as) | 0);
    const lowSmall = new Uint8Array(aw * ah);
    for (let y = 0; y < ah; y++) { const sy = (y * step) | 0; for (let x = 0; x < aw; x++) lowSmall[y * aw + x] = low[sy * w + ((x * step) | 0)]; }
    const inv = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) inv[i] = 255 - lowSmall[i];

    const { labels, stats, count } = connectedComponents(inv, aw, ah);
    const total = aw * ah;
    const minArea = Math.max(8, (total * 0.00002) | 0);
    const maxArea = (total * 0.05) | 0;

    const keep = new Uint8Array(count + 1);
    for (let r = 1; r <= count; r++) { const o = stats[r]; if (o.area >= minArea && o.area <= maxArea) keep[r] = 1; }

    if (opts.dotRecovery) {
      const keepMask = new Uint8Array(aw * ah);
      for (let i = 0; i < aw * ah; i++) if (keep[labels[i]]) keepMask[i] = 255;
      const recZone = dilate(keepMask, aw, ah, 15, 1);
      for (let r = 1; r <= count; r++) {
        if (keep[r]) continue;
        const o = stats[r];
        if (o.area < 3 || o.area >= minArea) continue;
        const cx = o.cx | 0, cy = o.cy | 0;
        if (cx < 0 || cy < 0 || cx >= aw || cy >= ah) continue;
        if (recZone[cy * aw + cx] === 0) continue;
        const boxArea = o.w * o.h;
        const fill = o.area / Math.max(1, boxArea);
        const aspect = Math.max(o.w, o.h) / Math.max(1, Math.min(o.w, o.h));
        if (fill > 0.20 && aspect < 6.0) keep[r] = 1;
      }
    }

    const maskSmall = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) maskSmall[i] = keep[labels[i]] ? 255 : 0;

    const dilateSize = Math.max(5, (W * 0.15 * as) | 0);
    const zoneSmall = dilate(maskSmall, aw, ah, dilateSize, 3);

    const zone = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { const sy = Math.min(ah - 1, (y * as) | 0); for (let x = 0; x < w; x++) zone[y * w + x] = zoneSmall[sy * aw + Math.min(aw - 1, (x * as) | 0)]; }

    // 背景清理 CC 也在 0.5x 执行（省 ~4x）
    const bgDarkSmall = new Uint8Array(aw * ah);
    for (let y = 0; y < ah; y++) { const sy = (y * step) | 0; for (let x = 0; x < aw; x++) { const fi = sy * w + ((x * step) | 0); bgDarkSmall[y * aw + x] = (zone[fi] === 0 && high[fi] === 0) ? 255 : 0; } }
    const bgcc = connectedComponents(bgDarkSmall, aw, ah);
    const bgKeep = new Uint8Array(bgcc.count + 1);
    for (let r = 1; r <= bgcc.count; r++) if (bgcc.stats[r].area >= minArea * 3) bgKeep[r] = 1;
    const bgMaskSmall = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) bgMaskSmall[i] = bgKeep[bgcc.labels[i]] ? 255 : 0;

    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { const sy = Math.min(ah - 1, (y * as) | 0); for (let x = 0; x < w; x++) { const si = sy * aw + Math.min(aw - 1, (x * as) | 0); out[y * w + x] = (zone[y * w + x] > 0) ? low[y * w + x] : (bgMaskSmall[si] ? high[y * w + x] : 255); } }
    return out;
  }

  // ---------- 白纸增强：去掉白纸上的细小噪点（连通域 CC 0.5x，下采样用 min 池化保住细笔画） ----------
  function removeSmallSpecks(bin, w, h, minFrac) {
    const as = 0.5, step = 1 / as;
    const aw = Math.max(1, (w * as) | 0), ah = Math.max(1, (h * as) | 0);
    // min 池化下采样：2x2 块取最暗值，确保 1px 细笔画在下采样后仍存在（不被点采样漏掉）
    const small = new Uint8Array(aw * ah);
    for (let y = 0; y < ah; y++) {
      const sy = y * step | 0, sy2 = Math.min(h - 1, sy + 1);
      for (let x = 0; x < aw; x++) {
        const sx = x * step | 0, sx2 = Math.min(w - 1, sx + 1);
        const v = Math.min(bin[sy * w + sx], bin[sy * w + sx2], bin[sy2 * w + sx], bin[sy2 * w + sx2]);
        small[y * aw + x] = v;
      }
    }
    // 反相：connectedComponents 以 255 为前景，故把暗(0)=文字/噪点 翻成 255 再分析
    const inv = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) inv[i] = 255 - small[i];
    const { labels, stats, count } = connectedComponents(inv, aw, ah);
    const total = aw * ah;
    // 相对阈值定位为“小噪点”，但封顶避免大图上把细笔画也误删
    const minArea = Math.max(4, Math.min(120, (total * minFrac) | 0));
    const keep = new Uint8Array(count + 1);
    for (let r = 1; r <= count; r++) if (stats[r].area >= minArea) keep[r] = 1;
    const keepMask = new Uint8Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) keepMask[i] = keep[labels[i]] ? 255 : 0;
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { const sy = Math.min(ah - 1, (y * as) | 0); for (let x = 0; x < w; x++) out[y * w + x] = keepMask[sy * aw + Math.min(aw - 1, (x * as) | 0)] ? bin[y * w + x] : 255; }
    return out;
  }

  // ---------- 主管线（模式分派） ----------
  function processGray(gray, w, h, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    let mode = o.mode;
    if (!mode) mode = (o.binary === false) ? 'gray' : (o.textAware ? 'text' : 'sauvola');
    o.mode = mode;
    const effScale = o.scale;
    const den = bilateral(gray, w, h, 2, 75, 75);
    const med = median1D(median1D(den, w, h, 2, true), w, h, 2, false);
    const norm = backgroundNormalize(med, w, h, o.bgBlurKsize);
    const cl = clahe(norm, w, h, o.claheGrid, o.claheLimit);
    const sharp = usm(cl, w, h, 3, o.sharpenAmount);

    if (mode === 'gray') {
      const out = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) out[i] = clamp255(sharp[i]);
      return out;
    }

    let bin;
    if (mode === 'adaptive') bin = adaptiveThreshold(sharp, w, h, adaptiveWindow(effScale), 10);
    else if (mode === 'otsu') bin = otsuThreshold(sharp, w, h);
    else if (mode === 'white') bin = sauvola(sharp, w, h, sauvolaWindow(effScale), o.sauvolaK, 128);
    else if (mode === 'sauvola') bin = sauvola(sharp, w, h, sauvolaWindow(effScale), o.sauvolaK, 128);
    else bin = textAwareBinarize(sharp, w, h, o); // text（默认）

    bin = morphology(bin, w, h, 'open', 1);
    bin = morphology(bin, w, h, 'close', 1);
    if (mode === 'white') bin = removeSmallSpecks(bin, w, h, 0.00003);
    return bin;
  }

  // ---------- 浏览器端编解码（主线程 / Worker 通用） ----------
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      return { canvas: c, ctx, toBlob: (mime, q) => c.convertToBlob({ type: mime, quality: q }) };
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    return { canvas: c, ctx, toBlob: (mime, q) => new Promise(res => c.toBlob(res, mime, q)) };
  }

  function decodeToGray(file, opts) {
    return createImageBitmap(file).then(bmp => {
      const ow = bmp.width, oh = bmp.height;
      let scale = opts.scale;
      const longSide = Math.max(ow, oh) * scale;
      if (longSide > opts.maxSide) scale = opts.maxSide / Math.max(ow, oh);
      const nw = Math.max(1, Math.round(ow * scale));
      const nh = Math.max(1, Math.round(oh * scale));
      const { ctx } = makeCanvas(nw, nh);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bmp, 0, 0, nw, nh);
      if (bmp.close) try { bmp.close(); } catch (e) {}
      const data = ctx.getImageData(0, 0, nw, nh).data;
      const gray = rgbaToGray(data, nw, nh);
      return { gray, w: nw, h: nh };
    });
  }

  function grayToBlob(bin, w, h, opts) {
    const { ctx, toBlob } = makeCanvas(w, h);
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0, j = 0; i < w * h; i++, j += 4) { const v = bin[i]; buf[j] = v; buf[j + 1] = v; buf[j + 2] = v; buf[j + 3] = 255; }
    ctx.putImageData(new ImageData(buf, w, h), 0, 0);
    const mime = opts.savePng ? 'image/png' : 'image/jpeg';
    const q = opts.savePng ? undefined : (opts.jpegQuality / 100);
    return toBlob(mime, q).then(blob => ({ blob, w, h }));
  }

  function processFile(file, opts) {
    return decodeToGray(file, opts).then(({ gray, w, h }) => {
      const result = processGray(gray, w, h, opts);
      return grayToBlob(result, w, h, opts);
    });
  }

  function grayToImageData(grayOrBin, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0, j = 0; i < w * h; i++, j += 4) { const v = grayOrBin[i]; out[j] = v; out[j + 1] = v; out[j + 2] = v; out[j + 3] = 255; }
    return new ImageData(out, w, h);
  }

  const api = {
    DEFAULTS, processGray, sauvola, adaptiveThreshold, otsuThreshold, clahe,
    connectedComponents, rgbaToGray, bilateral, median1D, backgroundNormalize,
    usm, gaussianBlur, boxBlur3, textAwareBinarize, removeSmallSpecks,
    medianFromHist, processFile, grayToImageData, sauvolaWindow, adaptiveWindow
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PhotoEnhance = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
