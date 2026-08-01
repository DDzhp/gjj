/* ============================================================
   兼容层 —— 在业务脚本之后加载
   作用：
   1. 原 工具集.html 内联脚本里定义了两份 showTool / toggleMobileMenu，
      它们依赖已被移除的旧 DOM（#mainToolSwitcher / #toolModal / .mobile-menu）。
      这里在业务脚本加载完毕后，把这些外壳级函数重新指回新外壳实现，
      确保面板中残留的 onclick="showTool('xxx')" 依旧可用。
   2. 补齐旧代码可能引用、但新外壳已不存在的 DOM 节点，避免 null 报错。
   ============================================================ */
(function () {
  'use strict';

  /* ---- 1. 夺回外壳级函数控制权 ----
     业务脚本里存在两处 function showTool(){} 声明（函数提升会覆盖
     window.showTool），且 tools.main-b.js 的 enhanceShowTool() 还会再包一层。
     这里在所有业务脚本执行完后，把 showTool 重新指回新外壳实现。
     注意：enhanceShowTool 的装饰逻辑只做按钮高亮，丢弃它不影响任何业务功能。 */
  if (typeof window.__shellShowTool === 'function') {
    window.showTool = window.__shellShowTool;
  }
  if (typeof window.__shellToggleMenu === 'function') {
    window.toggleMobileMenu = window.__shellToggleMenu;
    window.closeMobileMenu = window.__shellCloseMenu;
  }

  /* ---- 2. 旧代码可能查询的节点，缺失时提供惰性占位 ---- */
  var LEGACY_IDS = ['mainToolSwitcher', 'topToolSwitchBtn', 'toolModal',
                    'toolModalOverlay', 'currentToolName', 'toolSwitcherGrid'];

  var stash = document.getElementById('legacyStash');
  if (!stash) {
    stash = document.createElement('div');
    stash.id = 'legacyStash';
    stash.style.display = 'none';
    stash.setAttribute('aria-hidden', 'true');
    document.body.appendChild(stash);
  }

  LEGACY_IDS.forEach(function (id) {
    if (!document.getElementById(id)) {
      var d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      stash.appendChild(d);
    }
  });

  /* ---- 3. 全局错误兜底：避免单个工具报错导致整页卡死 ---- */
  window.addEventListener('error', function (e) {
    if (e && e.message) {
      console.warn('[工具集] 运行时错误:', e.message, e.filename + ':' + e.lineno);
    }
  });

  /* ---- 4. 移动端体验增强：为可横向溢出的表格自动包裹滚动容器 ---- */
  function wrapTables(root) {
    var tables = (root || document).querySelectorAll('table');
    Array.prototype.forEach.call(tables, function (tb) {
      var p = tb.parentElement;
      if (p && (p.classList.contains('table-wrap') ||
                p.classList.contains('table-responsive'))) return;
      var w = document.createElement('div');
      w.className = 'table-wrap';
      tb.parentNode.insertBefore(w, tb);
      w.appendChild(tb);
    });
  }

  function run() {
    wrapTables(document);
    // 工具切换后，动态生成的表格也要处理
    document.addEventListener('toolshown', function (ev) {
      var panel = document.getElementById(ev.detail.id);
      if (panel) setTimeout(function () { wrapTables(panel); }, 0);
    });
    // 监听动态插入的表格
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (muts) {
        var need = false;
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType === 1 &&
                (n.tagName === 'TABLE' || (n.querySelector && n.querySelector('table')))) {
              need = true;
            }
          });
        });
        if (need) wrapTables(document);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ---- 5. 复位初始工具 ----
     tools.main-a.js 的 DOMContentLoaded 回调里写死了 showTool('pulseTool')，
     会覆盖用户通过 URL hash / localStorage 选择的工具。
     这里在所有 DOMContentLoaded 回调跑完之后，再按新外壳的优先级复位一次：
        URL hash  >  localStorage  >  第一个工具 */
  function restoreInitialTool() {
    var tools = window.YL_TOOLS || [];
    if (!tools.length || typeof window.showTool !== 'function') return;

    var valid = {};
    tools.forEach(function (t) { valid[t.id] = true; });

    var want = (window.location.hash || '').slice(1);
    if (!valid[want]) {
      try {
        var saved = localStorage.getItem('selectedTool');
        want = valid[saved] ? saved : '';
      } catch (e) { want = ''; }
    }
    if (!want) want = tools[0].id;

    // 仅当当前显示的工具与目标不一致时才切换，避免重复初始化
    var panel = document.getElementById(want);
    if (panel && panel.style.display !== 'block') {
      window.showTool(want);
    } else {
      // 面板已正确显示，只需补齐侧边栏高亮与页头
      window.showTool(want);
    }
  }

  function boot() {
    run();
    // 排在业务脚本的 DOMContentLoaded 回调之后执行
    setTimeout(restoreInitialTool, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
