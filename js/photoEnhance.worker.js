/*!
 * photoEnhance.worker.js — 在 Web Worker 中执行图片处理，主线程零冻结。
 * 通过 importScripts 复用 photoEnhance.core.js（纯函数管线）。
 */
importScripts('photoEnhance.core.js');

self.onmessage = function (e) {
  const data = e.data || {};
  const id = data.id;
  const file = data.file;
  const opts = data.opts || {};
  if (!file) { self.postMessage({ id: id, ok: false, error: 'no file' }); return; }
  PhotoEnhance.processFile(file, opts).then(function (r) {
    self.postMessage({ id: id, ok: true, blob: r.blob, w: r.w, h: r.h }, [r.blob]);
  }).catch(function (err) {
    self.postMessage({ id: id, ok: false, error: String((err && err.message) || err) });
  });
};
