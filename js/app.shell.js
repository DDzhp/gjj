/* ============================================================
   应用外壳 —— 导航 / 工具切换 / 搜索 / 响应式抽屉
   说明：本文件只负责"外壳"，不改动任何工具内部业务逻辑。
        对外仍暴露 window.showTool(id)，与原版调用方式完全兼容。
   ============================================================ */
(function () {
  'use strict';

  var TOOLS = window.YL_TOOLS || [];
  var LS_KEY = 'selectedTool';          // 与原版保持一致
  var LS_RECENT = 'yl_recent_tools';

  var el = {};
  var currentTool = null;

  // ---- 密钥门：对指定工具增加访问密钥校验 ----
  var KG_SECRET = '983123';
  function injectKeyGateStyle() {
    if (window.__kgStyleInjected) return;
    window.__kgStyleInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.kg-gate{position:relative;max-width:520px;margin:40px auto;padding:32px 28px;background:#fff;border:1px solid #e3e8f0;border-radius:16px;box-shadow:0 12px 30px rgba(31,45,61,.08);text-align:center;}',
      '.kg-gate h3{margin:0 0 6px;font-size:20px;color:#2c3e50;}',
      '.kg-gate p{margin:0 0 18px;color:#7a8699;font-size:14px;}',
      '.kg-gate .kg-input{width:100%;max-width:240px;padding:12px 14px;font-size:16px;text-align:center;border:2px solid #e1e5e9;border-radius:10px;outline:none;transition:border-color .2s;}',
      '.kg-gate .kg-input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.12);}',
      '.kg-gate .kg-btn{margin-top:16px;padding:11px 28px;font-size:15px;font-weight:600;color:#fff;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:50px;cursor:pointer;transition:transform .15s;}',
      '.kg-gate .kg-btn:hover{transform:translateY(-2px);}',
      '.kg-gate .kg-err{margin-top:12px;min-height:18px;color:#e74c3c;font-size:13px;font-weight:600;}'
    ].join('');
    document.head.appendChild(s);
  }
  function initKeyGate(toolId) {
    if (window['__kg_' + toolId]) return;          // 已初始化
    window['__kg_' + toolId] = true;
    injectKeyGateStyle();
    var section = document.getElementById(toolId);
    if (!section) return;

    // 将现有内容包裹进 body（先隐藏）
    var body = document.createElement('div');
    body.className = 'kg-body';
    body.style.display = 'none';
    while (section.firstChild) body.appendChild(section.firstChild);

    // 构建密钥门
    var gate = document.createElement('div');
    gate.className = 'kg-gate';
    gate.innerHTML =
      '<h3>🔐 需要密钥访问</h3>' +
      '<p>该工具受访问限制，请输入访问密钥后继续使用。</p>' +
      '<div><input class="kg-input" type="password" placeholder="请输入访问密钥" autocomplete="off"></div>' +
      '<div><button class="kg-btn" type="button">解 锁</button></div>' +
      '<div class="kg-err"></div>';
    section.appendChild(gate);
    section.appendChild(body);

    var input = gate.querySelector('.kg-input');
    var btn = gate.querySelector('.kg-btn');
    var err = gate.querySelector('.kg-err');

    function unlock() {
      if (input.value.trim() === KG_SECRET) {
        gate.style.display = 'none';
        body.style.display = '';
        window['__kg_unlocked_' + toolId] = true;
      } else {
        err.textContent = '密钥错误，请重新输入。';
        input.value = '';
        input.focus();
      }
    }
    btn.addEventListener('click', unlock);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') unlock();
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
  }

  /* ---------- matchMedia 安全封装（兼容无该 API 的环境） ---------- */
  var MOBILE_Q = '(max-width: 860px)';
  function mql(query) {
    if (typeof window.matchMedia === 'function') {
      try { return window.matchMedia(query); } catch (e) {}
    }
    return null;
  }
  function isMobile() {
    var m = mql(MOBILE_Q);
    if (m) return m.matches;
    // 回退：直接判断视口宽度
    var w = window.innerWidth ||
            (document.documentElement && document.documentElement.clientWidth) || 0;
    return w > 0 && w <= 860;
  }

  /* ---------- 工具查找 ---------- */
  function findTool(id) {
    for (var i = 0; i < TOOLS.length; i++) {
      if (TOOLS[i].id === id) return TOOLS[i];
    }
    return null;
  }

  /* ---------- Toast ---------- */
  function toast(msg, type, duration) {
    var host = document.querySelector('.yl-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'yl-toast-host';
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'yl-toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(-8px)';
      setTimeout(function () { t.remove(); }, 260);
    }, duration || 2200);
  }
  window.ylToast = toast;

  /* ---------- 最近使用 ---------- */
  function pushRecent(id) {
    try {
      var list = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
      list = list.filter(function (x) { return x !== id; });
      list.unshift(id);
      localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 6)));
    } catch (e) {}
  }

  /* ---------- 核心：显示指定工具 ---------- */
  function showTool(toolId) {
    var tool = findTool(toolId);
    if (!tool) {
      // 未知 id：回退到第一个工具
      tool = TOOLS[0];
      if (!tool) return;
      toolId = tool.id;
    }

    // 1. 隐藏所有面板
    for (var i = 0; i < TOOLS.length; i++) {
      var p = document.getElementById(TOOLS[i].id);
      if (p) p.style.display = 'none';
    }

    // 2. 显示目标面板
    var panel = document.getElementById(toolId);
    if (panel) {
      panel.style.display = 'block';
      // 重放入场动画
      panel.style.animation = 'none';
      void panel.offsetWidth;
      panel.style.animation = '';
    }

    // 3. 同步高亮（常用切换条 + 全部工具面板）
    var items = document.querySelectorAll('[data-tool-id]');
    for (var j = 0; j < items.length; j++) {
      var active = items[j].getAttribute('data-tool-id') === toolId;
      items[j].classList.toggle('is-active', active);
      items[j].setAttribute('aria-current', active ? 'page' : 'false');
    }

    // 4. 持久化 + 路由
    currentTool = toolId;
    try { localStorage.setItem(LS_KEY, toolId); } catch (e) {}
    pushRecent(toolId);
    if (window.location.hash.slice(1) !== toolId) {
      try {
        history.replaceState(null, '', '#' + toolId);
      } catch (e) { window.location.hash = toolId; }
    }
    document.title = tool.name + ' - 统一工具集';

    // 6. 移动端自动收起抽屉
    if (isMobile()) closeDrawer();

    // 7. 回到顶部
    try { window.scrollTo(0, 0); } catch (e) {}

    // 8. 保留原版的"按需初始化"逻辑（原 showTool 中的分支，行为完全一致）
    try {
      if (toolId === 'qrGeneratorTool' && typeof window.initQRGenerator === 'function') {
        window.initQRGenerator();
      }
      if (toolId === 'serialNumberTool' && typeof window.initSerialNumberTool === 'function') {
        window.initSerialNumberTool();
      }
      if (toolId === 'logAnalysisTool') {
        if (typeof window.initKeyGate === 'function') initKeyGate('logAnalysisTool');
      }
      if (toolId === 'photoEnhanceTool' && typeof window.ScanApp === 'object' && typeof window.ScanApp.init === 'function') {
        if (!window.__scanAppInited) {
          window.__scanAppInited = true;
          window.ScanApp.init();
        }
      }
      if (toolId === 'qyLogTool' && typeof window.QyLogInit === 'function') {
        if (!window.__qyLogInited) {
          window.__qyLogInited = true;
          window.QyLogInit();
        }
      }
      if (toolId === 'qyLogTool') {
        if (typeof window.initKeyGate === 'function') initKeyGate('qyLogTool');
      }
      if (toolId === 'countdownTool' && typeof window.initCountdownTool === 'function') {
        window.initCountdownTool();
      }
    } catch (e) {
      console.warn('[工具集] 工具初始化异常:', toolId, e);
    }

    // 9. 同步原版全局变量，供业务代码读取
    try { window.currentActiveTool = toolId; } catch (e) {}

    // 10. 通知业务层（供需要懒初始化的工具使用）
    try {
      document.dispatchEvent(new CustomEvent('toolshown', { detail: { id: toolId } }));
    } catch (e) {}
  }

  // 对外暴露，覆盖旧版实现，保持同名同参
  window.showTool = showTool;
  // 暴露密钥门函数，供 showTool 内部按需调用
  window.initKeyGate = initKeyGate;
  // 备份一份，供 app.compat.js 在业务脚本加载后夺回控制权
  window.__shellShowTool = showTool;

  /* ---------- 移动端侧边栏抽屉 ---------- */
  function openDrawer() {
    el.nav && el.nav.classList.add('is-open');
    el.scrim && el.scrim.classList.add('is-open');
    el.burger && el.burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    el.nav && el.nav.classList.remove('is-open');
    el.scrim && el.scrim.classList.remove('is-open');
    el.burger && el.burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  function toggleDrawer() {
    if (el.nav && el.nav.classList.contains('is-open')) closeDrawer();
    else openDrawer();
  }
  // 兼容原版移动端菜单 API
  window.toggleMobileMenu = toggleDrawer;
  window.closeMobileMenu = closeDrawer;
  window.__shellToggleMenu = toggleDrawer;
  window.__shellCloseMenu = closeDrawer;

  /* ---------- 构建单一工具栏（常用胶囊 + 展开更多） ---------- */
  function buildNav() {
    var htmlCommon = '';
    var htmlMore = '';

    // 常用工具置顶顺序：把重点工具（如入库参数生成）排到最前面
    var PRIORITY = ['stockParamTool', 'iccidTool', 'excelTemplateTool', 'qrGeneratorTool'];
    var commonTools = TOOLS.filter(function (t) { return t.common; });
    commonTools.sort(function (a, b) {
      var ia = PRIORITY.indexOf(a.id);
      var ib = PRIORITY.indexOf(b.id);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      return ia - ib;
    });

    commonTools.forEach(function (t) {
      if (!t.common) return;
      htmlCommon += '<button type="button" class="tool-bar__item" data-tool-id="' + t.id + '">' +
                      '<span class="tool-bar__icon">' + t.icon + '</span>' +
                      '<span class="tool-bar__label">' + t.name + '</span>' +
                    '</button>';
    });

    // "查看更多"面板仅显示非常用工具，避免与顶部常用条重复
    TOOLS.forEach(function (t) {
      if (t.common) return;
      htmlMore += '<button type="button" class="tool-bar__item" data-tool-id="' + t.id + '">' +
                    '<span class="tool-bar__icon">' + t.icon + '</span>' +
                    '<span class="tool-bar__label">' + t.name + '</span>' +
                  '</button>';
    });

    if (el.switch) el.switch.innerHTML = htmlCommon;
    if (el.allPanel) el.allPanel.innerHTML = htmlMore;

    var onSwitch = function (e) {
      var btn = e.target.closest('[data-tool-id]');
      if (!btn) return;
      // 阻止冒泡到工具栏背景的点击（背景用于展开/收起）
      e.stopPropagation();
      showTool(btn.getAttribute('data-tool-id'));
    };
    el.switch && el.switch.addEventListener('click', onSwitch);
    el.allPanel && el.allPanel.addEventListener('click', onSwitch);

    // 点击工具栏背景（非按钮区域）展开 / 收起全部工具
    if (el.toolBar) {
      el.toolBar.addEventListener('click', function (e) {
        if (e.target.closest('.tool-bar__item, .tool-bar__toggle')) return;
        toggleToolbar();
      });
    }
  }

  /* ---------- 快捷键 ---------- */
  function bindShortcuts() {
    document.addEventListener('keydown', function (e) {
      // Esc 收起抽屉
      if (e.key === 'Escape') closeDrawer();
    });
  }

  /* ---------- 工具栏展开 / 收起 ---------- */
  function toggleToolbar(force) {
    if (!el.allPanel) return;
    var isOpen = el.allToggle && el.allToggle.getAttribute('aria-expanded') === 'true';
    var open = (typeof force === 'boolean') ? force : !isOpen;
    el.allPanel.style.display = open ? '' : 'none';
    if (el.allToggle) {
      el.allToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var labelSpan = el.allToggle.querySelector('.tool-bar__label');
      var caretSpan = el.allToggle.querySelector('.tool-bar__caret');
      if (labelSpan) labelSpan.textContent = open ? '收起' : '查看更多';
      if (caretSpan) caretSpan.textContent = open ? '▼' : '▲';
    }
  }

  /* ---------- 搜索（过滤工具栏） ---------- */
  function bindSearch() {
    if (!el.searchInput) return;
    var clearBtn = el.searchClear;

    function apply(kw) {
      kw = (kw || '').trim().toLowerCase();
      var items = document.querySelectorAll('.tool-bar__item');
      var matchCount = 0;
      items.forEach(function (btn) {
        var id = btn.getAttribute('data-tool-id');
        var t = findTool(id);
        if (!t) return;
        var hay = (t.name + ' ' + (t.keywords || '') + ' ' + (t.desc || '')).toLowerCase();
        var hit = !kw || hay.indexOf(kw) !== -1;
        btn.style.display = hit ? '' : 'none';
        if (hit) matchCount++;
      });
      // 有搜索词时展开全部工具面板，便于查看匹配结果
      if (kw && el.allPanel) toggleToolbar(true);
      if (clearBtn) clearBtn.hidden = !kw;
      if (el.searchInput) el.searchInput.setAttribute('aria-label', '搜索工具' + (kw ? '（' + matchCount + ' 个结果）' : ''));
    }

    el.searchInput.addEventListener('input', function () { apply(el.searchInput.value); });
    el.searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { el.searchInput.value = ''; apply(''); }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        el.searchInput.value = '';
        apply('');
        el.searchInput.focus();
      });
    }
  }

  /* ---------- 决定初始工具 ---------- */
  function resolveInitial() {
    var hash = (window.location.hash || '').slice(1);
    if (hash && findTool(hash)) return hash;
    try {
      var saved = localStorage.getItem(LS_KEY);
      if (saved && findTool(saved)) return saved;
    } catch (e) {}
    // 默认打开「入库参数生成」工具
    if (findTool('stockParamTool')) return 'stockParamTool';
    return TOOLS.length ? TOOLS[0].id : null;
  }

  /* ---------- 初始化 ---------- */
  function init() {
    el.switch     = document.getElementById('toolSwitch');
    el.allToggle  = document.getElementById('allToolsToggle');
    el.allPanel   = document.getElementById('allToolsPanel');
    el.toolBar    = document.getElementById('toolBar');
    el.nav        = document.getElementById('toolNav');
    el.scrim      = document.getElementById('appScrim');
    el.burger     = document.getElementById('appBurger');
    el.navClose   = document.getElementById('appNavClose');
    el.searchInput = document.getElementById('searchInput');
    el.searchClear = document.getElementById('searchClear');

    buildNav();
    bindShortcuts();
    bindSearch();

    // "查看更多 / 收起" 切换（按钮与背景共用）
    if (el.allToggle) {
      el.allToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleToolbar();
      });
    }

    // 汉堡 / 遮罩 / 关闭按钮：移动端侧边栏抽屉
    el.burger  && el.burger.addEventListener('click', openDrawer);
    el.navClose && el.navClose.addEventListener('click', closeDrawer);
    el.scrim   && el.scrim.addEventListener('click', closeDrawer);

    // 移动端：选中工具后自动收起抽屉（PC 无影响）
    document.addEventListener('toolshown', function () { if (isMobile()) closeDrawer(); });

    // 视口切换时复位抽屉
    var onMQ = function () { if (!isMobile()) closeDrawer(); };
    var mq = mql(MOBILE_Q);
    if (mq && mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq && mq.addListener) mq.addListener(onMQ);
    else window.addEventListener('resize', onMQ);

    // hash 路由
    window.addEventListener('hashchange', function () {
      var h = (window.location.hash || '').slice(1);
      if (h && h !== currentTool && findTool(h)) showTool(h);
    });

    var initial = resolveInitial();
    if (initial) showTool(initial);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
