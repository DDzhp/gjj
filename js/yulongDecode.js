/* ============================================================
 * yulongDecode.js — 跃龙4.0 TCP通讯报文解析（工具集面板）
 * 依据：《跃龙4.0（适用于主板离线消费储存消费记录）扫码刷卡一体通信协议.pdf》
 *        +《命令表.xls》
 * 报文规格：
 *   心跳包 = 4 字节（仅设备 ID）
 *   指令包 = 58 字节定长（标准，含北京时间/机器类型/校验）
 *   旧版   = 52 字节定长（兼容：无流量 4B 字段，见《命令表》52字节行）
 * 输出：逐字段十六进制 + 十进制值 + 中文白话翻译；并生成一段自然语言解读。
 * 纯本地解析，不联网。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 枚举表（PDF 第五章/命令表） ---------------- */
  var MODES = { 0: '时长', 1: '流量', 2: '滤芯', 3: '买断', 4: '套餐', 5: '共享' };
  var TYPES = { 0: '家用机/商务机', 1: '台面机', 2: '管线机', 3: '售水机/校园机/医院机' };
  var STATES = {
    0: '出厂', 1: '正常', 2: '欠费', 3: '制水故障', 4: '关机', 5: '漏水', 6: '待激活', 7: '补计',
    8: '频发数据', 9: '制水', 10: '冲洗', 11: '缺水', 12: '锁定', 14: '本次消费纯水溢出',
    30: '水箱纯水溢出', 31: '浮球异常', 32: '加热超时', 35: '热水温度传感器故障', 36: '加热管故障',
    37: '原水温度传感器故障', 39: '放水泵故障', 44: '热水流量计故障', 50: '大通量流量计故障',
    51: '小通量流量计故障', 52: '低液位（纯水箱水压不足）', 53: '消毒中', 54: '废水管堵塞',
    55: '补水阀（纯水进水阀）故障'
  };

  /* 命令表：cmd -> {n: 名称, d: down(平台下发)|up(设备上报), t: 补充说明}
     （源自 PDF 第一章，红=下发 黑=上报） */
  var CMDS = {
    '00': { n: '心跳包', d: 'up', t: '设备每6分钟上报，心跳只有ID号(4字节)' },
    '01': { n: '关机命令', d: 'down' },
    '11': { n: '关机命令回执', d: 'up' },
    '02': { n: '开机命令', d: 'down' },
    '22': { n: '开机命令回执', d: 'up' },
    '03': { n: '强冲命令', d: 'down', t: '强制冲洗' },
    '33': { n: '强冲命令回执', d: 'up' },
    '04': { n: 'ID编码/设置机器参数', d: 'down', t: '两种含义：1)设备请求ID编码(上行带信号与ICCID)；2)平台下发设备ID/滤芯计算方式/费率/检修等' },
    '44': { n: 'ID编码回执', d: 'up' },
    '05': { n: '充值命令', d: 'down', t: '按计费模式充流量或充天数' },
    '55': { n: '充值命令回执', d: 'up', t: '共享模式下为设备忙碌状态回执' },
    '06': { n: '用水同步命令', d: 'up', t: '设备发生用水后上报，流量≥20ml才上报' },
    '07': { n: '滤芯复位', d: 'down', t: '当前滤芯实时=最大值即可复位' },
    '77': { n: '滤芯复位回执', d: 'up' },
    '08': { n: '模式切换', d: 'down' },
    '88': { n: '模式切换回执', d: 'up' },
    '09': { n: '系统初始化', d: 'down', t: '更新剩余流量/时间、已用、北京时间等' },
    '99': { n: '系统初始化回执', d: 'up' },
    '0a': { n: '恢复出厂设置', d: 'down' },
    'aa': { n: '恢复出厂设置回执', d: 'up' },
    '0b': { n: '用时同步', d: 'down', t: '更新已用时间、剩余时间、北京时间' },
    'bb': { n: '用时同步回执', d: 'up' },
    '0c': { n: '设备状态变更', d: 'up' },
    '0d': { n: '查询设备信息', d: 'down' },
    'dd': { n: '查询设备信息回执', d: 'up' },
    '0e': { n: '获取信号/ICCID/机器配置参数', d: 'down' },
    'ee': { n: '获取设备信息回执', d: 'up', t: '含滤芯计算方式/流量方式/检修时间/冷热水温度' },
    '0f': { n: '机器锁定解锁命令', d: 'down' },
    'ff': { n: '机器锁定解锁回执', d: 'up' },
    '80': { n: '机器取水指令', d: 'down', t: '共享模式有效：允许流量/等待时间/IC卡号等' },
    '90': { n: '机器取水指令回执', d: 'up' },
    'cc': { n: '错误包上报', d: 'up', t: '设备收到校验错误的下发数据时上报' },
    'a0': { n: 'Ic卡识别请求指令', d: 'up', t: '设备上报当前读到的IC卡信息' },
    'd0': { n: '键盘输入手机号和密码上报', d: 'up', t: '无卡取水场景' },
    '82': { n: '设置节能时间/浴霸温度/臭氧时间', d: 'down' },
    '92': { n: '节能浴霸臭氧设置回执', d: 'up' },
    '83': { n: '设置广告灯工作时间', d: 'down' },
    '93': { n: '广告灯设置回执', d: 'up' },
    '84': { n: '启动自动校准流量系数', d: 'down' },
    '94': { n: '自动校准回执', d: 'up' },
    '5e': { n: '自动校准流量系数结束上报', d: 'up', t: '上报校准完成的流量脉冲/放水秒数' }
  };

  /* ---------------- 布局（0-based 字节起点 / 长度） ----------------
     58B（PDF 第2章）；52B 与 58B 差异 = 充值流量/剩余流量/已用流量由 4B 改为 2B */
  var LAYOUT58 = [
    { k: 'dev', pos: '01-04', name: '设备ID', len: 4 },
    { k: 'mode', pos: '05', name: '计费模式', len: 1 },
    { k: 'cmd', pos: '06', name: '命令', len: 1 },
    { k: 'state', pos: '07', name: '设备状态', len: 1 },
    { k: 'cur', pos: '08-09', name: '本次消费', len: 2 },
    { k: 'rcf', pos: '10-13', name: '充值流量', len: 4 },
    { k: 'rcd', pos: '14-15', name: '充值天数', len: 2 },
    { k: 'rmf', pos: '16-19', name: '剩余流量', len: 4 },
    { k: 'rmd', pos: '20-21', name: '剩余天数', len: 2 },
    { k: 'usf', pos: '22-25', name: '已用流量', len: 4 },
    { k: 'usd', pos: '26-27', name: '已用天数', len: 2 },
    { k: 'ptds', pos: '28-29', name: '纯水TDS', len: 2 },
    { k: 'rTds', pos: '30-31', name: '原水TDS', len: 2 },
    { k: 'f1', pos: '32-33', name: '一滤实时值', len: 2 },
    { k: 'f2', pos: '34-35', name: '二滤实时值', len: 2 },
    { k: 'f3', pos: '36-37', name: '三滤实时值', len: 2 },
    { k: 'f4', pos: '38-39', name: '四滤实时值', len: 2 },
    { k: 'f5', pos: '40-41', name: '五滤实时值', len: 2 },
    { k: 'm1', pos: '42-43', name: '一滤最大值', len: 2 },
    { k: 'm2', pos: '44-45', name: '二滤最大值', len: 2 },
    { k: 'm3', pos: '46-47', name: '三滤最大值', len: 2 },
    { k: 'm4', pos: '48-49', name: '四滤最大值', len: 2 },
    { k: 'm5', pos: '50-51', name: '五滤最大值', len: 2 },
    { k: 'time', pos: '52-55', name: '北京时间', len: 4 },
    { k: 'type', pos: '56', name: '机器类型码', len: 1 },
    { k: 'cs', pos: '57-58', name: '校验位', len: 2 }
  ];
  var LAYOUT52 = [
    { k: 'dev', pos: '01-04', name: '设备ID', len: 4 },
    { k: 'mode', pos: '05', name: '计费模式', len: 1 },
    { k: 'cmd', pos: '06', name: '命令', len: 1 },
    { k: 'state', pos: '07', name: '设备状态', len: 1 },
    { k: 'cur', pos: '08-09', name: '本次消费', len: 2 },
    { k: 'rcf', pos: '10-11', name: '充值流量', len: 2 },
    { k: 'rcd', pos: '12-13', name: '充值天数', len: 2 },
    { k: 'rmf', pos: '14-15', name: '剩余流量', len: 2 },
    { k: 'rmd', pos: '16-17', name: '剩余天数', len: 2 },
    { k: 'usf', pos: '18-19', name: '已用流量', len: 2 },
    { k: 'usd', pos: '20-21', name: '已用天数', len: 2 },
    { k: 'ptds', pos: '22-23', name: '纯水TDS', len: 2 },
    { k: 'rTds', pos: '24-25', name: '原水TDS', len: 2 },
    { k: 'f1', pos: '26-27', name: '一滤实时值', len: 2 },
    { k: 'f2', pos: '28-29', name: '二滤实时值', len: 2 },
    { k: 'f3', pos: '30-31', name: '三滤实时值', len: 2 },
    { k: 'f4', pos: '32-33', name: '四滤实时值', len: 2 },
    { k: 'f5', pos: '34-35', name: '五滤实时值', len: 2 },
    { k: 'm1', pos: '36-37', name: '一滤最大值', len: 2 },
    { k: 'm2', pos: '38-39', name: '二滤最大值', len: 2 },
    { k: 'm3', pos: '40-41', name: '三滤最大值', len: 2 },
    { k: 'm4', pos: '42-43', name: '四滤最大值', len: 2 },
    { k: 'm5', pos: '44-45', name: '五滤最大值', len: 2 },
    { k: 'time', pos: '46-49', name: '北京时间', len: 4 },
    { k: 'type', pos: '50', name: '机器类型码', len: 1 },
    { k: 'cs', pos: '51-52', name: '校验位', len: 2 }
  ];

  function u16(b, i) { return ((b[i] << 8) | b[i + 1]) >>> 0; }
  function u32(b, i) {
    return (((b[i] << 24) >>> 0) + ((b[i + 1] << 16) >>> 0) + ((b[i + 2] << 8) >>> 0) + b[i + 3]) >>> 0;
  }
  function hexOf(b, s, l) {
    var out = '';
    for (var i = s; i < s + l; i++) out += (b[i].toString(16).padStart(2, '0').toUpperCase());
    return out;
  }
  function secToHMS(sec) {
    sec = (sec || 0) % 86400;
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function yuan(fen) { return (fen / 100).toFixed(2) + ' 元'; }

  /* 净化一行输入：返回 {hex, note}。自动剥离常见日志前缀（时间/方向），挑最接近目标长度的 hex 段 */
  function cleanLine(raw, expectBytes) {
    var line = (raw || '').replace(/\s+/g, ' ').trim();
    var candidates = [];
    var re = /(?:0x)?([0-9A-Fa-f]{2,}(?:[\s\-:]*(?:0x)?[0-9A-Fa-f]{2,})*)/g;
    var m;
    while ((m = re.exec(line)) !== null) {
      var h = m[0].replace(/0x/gi, '').replace(/[^0-9A-Fa-f]/g, '');
      if (h.length >= 6 && h.length % 2 === 0) candidates.push(h);
    }
    if (candidates.length === 0) {
      var whole = line.replace(/[^0-9A-Fa-f]/g, '');
      if (whole.length % 2 === 0 && whole.length >= 6) candidates.push(whole);
    }
    if (candidates.length === 1) return { hex: candidates[0] };
    // 多候选：优先等于目标长度，其次最接近目标长度
    var target = expectBytes * 2;
    candidates.sort(function (a, b) {
      return Math.abs(a.length - target) - Math.abs(b.length - target);
    });
    return { hex: candidates[0] };
  }

  /* 解析整帧。返回 {ok, err, kind:'heart'|'full', bytes, layout, F(字段值map), rows, speak, summary, rawHex} */
  function decode(line, expectBytes) {
    var cleaned = cleanLine(line, expectBytes);
    var hex = cleaned.hex || '';
    var out = { ok: false, kind: '', rows: [], speak: '', summary: [], rawHex: hex };
    if (!hex) { out.err = '未提取到十六进制数据'; return out; }
    if (hex.length % 2 !== 0) { out.err = '十六进制长度为奇数（' + hex.length + '），请检查是否漏了半个字节'; return out; }
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    var n = bytes.length;

    // 心跳包：4 字节纯设备ID
    if (n === 4) {
      out.ok = true; out.kind = 'heart';
      var id = u32(bytes, 0);
      out.rows = [
        { pos: '01-04', name: '设备ID', hex: hexOf(bytes, 0, 4), val: id, trans: '设备ID：' + id }
      ];
      out.summary = [
        { name: '包类型', value: '心跳包（4字节，仅含设备ID）' },
        { name: '设备ID', value: String(id) }
      ];
      out.speak = '设备（ID=' + id + '）向平台上报心跳包，表示设备在线。';
      return out;
    }

    var layout = null, kind = '';
    if (n === 58) { layout = LAYOUT58; kind = '58B 标准指令包'; }
    else if (n === 52) { layout = LAYOUT52; kind = '52B 旧版指令包'; }
    else {
      out.err = '字节数 ' + n + ' 不支持（支持：4B心跳 / 52B旧版 / 58B标准）。' +
        (n > 58 ? '多包粘包请拆行，每行一包。' : '');
      return out;
    }

    // 提取字段值
    var F = {};
    var idx = 0;
    for (var li = 0; li < layout.length; li++) {
      var f = layout[li];
      F[f.k] = (f.len === 1) ? bytes[idx] : (f.len === 2) ? u16(bytes, idx) : u32(bytes, idx);
      idx += f.len;
    }
    out.bytes = bytes; out.kind = kind; out.layout = layout; out.F = F;
    var cmdHex = F.cmd.toString(16).toUpperCase().padStart(2, '0');
    var cmdInfo = CMDS[cmdHex.toLowerCase()] || null;
    var dir = cmdInfo ? cmdInfo.d : (cmdHex === cmdHex.toUpperCase() ? '' : '');

    /* ============ 逐字段翻译（结合 命令/方向/模式） ============ */
    var rowList = [];
    function pushRow(fld, hexStr, val, trans) {
      rowList.push({ pos: fld.pos, name: fld.name, hex: hexStr, val: val, trans: trans });
    }
    // 预定义偏移（按 layout 顺序累加）
    var off = {};
    (function () {
      var c = 0;
      for (var x = 0; x < layout.length; x++) { off[layout[x].k] = c; c += layout[x].len; }
    })();
    function fieldHex(k) {
      var f = null;
      for (var i = 0; i < layout.length; i++) if (layout[i].k === k) f = layout[i];
      if (!f) return '';
      return hexOf(bytes, off[k], f.len);
    }
    function getField(k) {
      var f = null;
      for (var i = 0; i < layout.length; i++) if (layout[i].k === k) f = layout[i];
      return f;
    }
    var _2B = { rcf: 2, rmf: 2, usf: 2 };
    var modeName = MODES[F.mode] || ('未知(0x' + F.mode.toString(16) + ')');
    var stateName = STATES[F.state] || ('未知(0x' + F.state.toString(16) + ')');
    var isUp = cmdInfo ? cmdInfo.d === 'up' : false;
    var isDown = cmdInfo ? cmdInfo.d === 'down' : false;

    /* ---- 通用解释函数：字段级 ---- */
    function tDev() { return '设备ID：' + F.dev + (F.dev === 0 ? '（未编码，出厂默认0，等待平台分配）' : ''); }
    function tMode() {
      var s = '计费模式：' + modeName + '模式';
      if (F.mode === 0) s += '（时长，时间归零停机）';
      else if (F.mode === 1) s += '（流量，流量归零停机）';
      else if (F.mode === 2) s += '（滤芯，任一滤芯归零停机）';
      else if (F.mode === 3) s += '（买断，无租赁功能）';
      else if (F.mode === 4) s += '（套餐，时间或流量任一归零停机）';
      else if (F.mode === 5) s += '（共享，扫码出水）';
      return s;
    }
    function tCmd() {
      if (!cmdInfo) return '命令 0x' + cmdHex + '：协议未收录';
      return '命令 0x' + cmdHex + '「' + cmdInfo.n + '」' + (cmdInfo.d === 'up' ? '（设备→平台 上报）' : '（平台→设备 下发）');
    }
    function tState() {
      if (isDown && cmdHex === '04') return '设备状态：滤芯寿命计算方式=' + (F.state === 1 ? '按流量(升)' : '按时间(天)') + '（0x04下发时该位含义）';
      if (isDown && cmdHex === '84') {
        var w = { 0: '冷水流量计(小通量/流量计2)脉冲', 1: '热水流量计(大通量/流量计1)脉冲', 2: '小通量(2分灌装泵)放水秒数', 3: '大通量(4分灌装泵)放水秒数' };
        return '设备状态：校准对象=' + (w[F.state] || F.state);
      }
      if (isUp && cmdHex === 'EE') return '设备状态：滤芯寿命类型=' + (F.state === 1 ? '按流量' : '按时间') + '（0xEE上报含义）';
      return '设备状态：' + stateName + (F.state >= 30 ? '（故障类，需处理）' : '');
    }
    function tCur() {
      // 08-09 本次消费
      if (isDown && cmdHex === '84') return '自动校准流量：' + F.cur + ' 毫升';
      if (isDown) return '本次消费：' + F.cur + '（下发指令时应为0）';
      if (isUp && cmdHex === '06') return '本次出水总流量：' + F.cur + ' 毫升 ≈ ' + (F.cur / 1000).toFixed(3) + ' 升';
      return '本次消费：' + F.cur + '（未定义，通常为0）';
    }
    function tRcf() {
      var u = (F.rcf || 0);
      if (isDown && cmdHex === '04') return '冷水流量计(小通量)每升脉冲数：' + u + ' 脉冲/升（范围100-10000，不按脉冲计则0）';
      if (isDown && cmdHex === '05') return '充值流量：' + u + ' 升';
      if (isDown && cmdHex === '80') return '本次允许消费流量：' + u + ' 毫升（共享取水，流量用完即结束）';
      if (isDown && cmdHex === '82') return '设备启动节能时间：' + u + ' 分钟（0-1440）';
      if (isDown && cmdHex === '83') return '广告灯开启时间：' + u + ' 分钟（0-1440）';
      if (isUp && cmdHex === '5E') return '自动校准冷水流量计脉冲数：' + u + ' 脉冲/升（后台请同步）';
      if (isUp && cmdHex === '06') return '本次出热水水量：' + u + ' 毫升（20-65535）';
      return '充值流量：' + u + (cmdInfo && cmdInfo.d ? '' : '');
    }
    function tRcd() {
      if (isDown && cmdHex === '04') return '冷水阀(放水阀2,2分灌装泵)放水一升时间：' + F.rcd + ' 秒/升（范围10-800）';
      if (isDown && cmdHex === '05') return '充值天数：' + F.rcd + ' 天';
      if (isDown && cmdHex === '80') return '等待本次取水时间：' + F.rcd + ' 秒（超时未取水结束）';
      if (isDown && cmdHex === '82') return '加热系统启停温差：' + F.rcd + ' ℃（5-80）';
      if (isUp && cmdHex === '5E') return '自动校准放水阀2(冷水阀)放水一升时间：' + F.rcd + ' 秒/升';
      if (isUp && cmdHex === '06') return '本次出冷水水量：' + F.rcd + ' 毫升（20-65535）';
      return '充值天数：' + F.rcd + ' 天';
    }
    function tRmf() {
      if (isDown && cmdHex === '04') return '水泵每制一升纯水所需时间：' + F.rmf + ' 秒/升（不按制水时间则0）';
      if (isDown && cmdHex === '09') return '初始剩余流量：' + F.rmf + ' 升（默认10升）';
      if (isDown && cmdHex === '80') return '连续出水最大时间：' + F.rmf + ' 秒（1-30000，超时结束放水）';
      if (isDown && cmdHex === '82') return '浴霸1启动温度：' + F.rmf + ' ℃';
      if (isUp && cmdHex === '06') return '本次消费金额：' + yuan(F.rmf) + '（共享模式，单位分）';
      if (isUp && cmdHex === 'A0') return '离线消费金额：' + yuan(F.rmf) + '（该卡离线期间消费，单位分）';
      return '剩余流量：' + F.rmf + ' 升';
    }
    function tRmd() {
      if (isDown && cmdHex === '04') return '水泵连续制水触发制水故障时间：' + F.rmd + ' 分钟（1-1440）';
      if (isDown && (cmdHex === '09' || cmdHex === '0B')) return '设备剩余使用时间：' + F.rmd + ' 天（默认10天）';
      if (isDown && cmdHex === '80') return '放水后暂停保留时间：' + F.rmd + ' 秒（超时结束放水）';
      if (isDown && cmdHex === '82') return '浴霸2启动温度：' + F.rmd + ' ℃';
      return '剩余天数：' + F.rmd + ' 天';
    }
    function tUsf() {
      if (isDown && cmdHex === '04') return '加热最高温度值：' + F.usf + ' ℃（1-100）';
      if (isDown && cmdHex === '80') return '出水热水温度值：' + F.usf + ' ℃（即热式机器）';
      if (isDown && cmdHex === '82') return '浴霸1关闭温差：' + F.usf + ' ℃';
      return '已用流量：' + F.usf + ' 升';
    }
    function tUsd() {
      if (isDown && cmdHex === '04') return '制冷最低温度值：' + F.usd + ' ℃（1-100）';
      if (isDown && (cmdHex === '09' || cmdHex === '0B')) return '设备已用时间：' + F.usd + ' 天';
      if (isDown && cmdHex === '82') return '浴霸2关闭温差：' + F.usd + ' ℃';
      return '已用天数：' + F.usd + ' 天';
    }
    function tPtds() {
      if (isDown && cmdHex === '04') return '热水费率：' + F.ptds + ' 毫升/分';
      return '纯水TDS：' + F.ptds + ' ppm';
    }
    function tRTds() {
      if (isDown && cmdHex === '04') return '冷水费率：' + F.rTds + ' 毫升/分';
      return '原水TDS：' + F.rTds + ' ppm';
    }
    function balFen() { return u32(bytes, off.f1); }  // 32-35 共4字节余额
    function tF1() {
      if (isDown && cmdHex === '04') {
        var w = { 0: '不屏蔽', 1: '屏蔽冷水水路流量计', 2: '屏蔽热水水路流量计', 3: '屏蔽冷热水两路流量计' };
        return '屏蔽水路选择：' + (w[F.f1] || F.f1);
      }
      if (isDown && cmdHex === '80') return 'IC卡账户余额(高16位)：' + yuan(balFen()) + '（32-35字节合计余额，单位分）';
      if (isDown && cmdHex === '82') return '臭氧发生器工作周期：' + F.f1 + ' 秒（600-60000）';
      if (isUp && (cmdHex === '06' || cmdHex === 'A0')) return 'IC卡账户余额(高16位)：' + yuan(balFen());
      return '第一滤芯实时寿命：' + F.f1 + (F.mode === 2 ? '（升/天，按滤芯模式）' : '');
    }
    function tF2() {
      if (isDown && cmdHex === '04') return '单次消费最大放水量：' + F.f2 + ' 毫升（超量结束消费）';
      if (isDown && cmdHex === '80') return 'IC卡账户余额(低16位)：' + yuan(balFen());
      if (isDown && cmdHex === '82') return '臭氧工作周期内启动时间：' + F.f2 + ' 秒（0-240）';
      if (isUp && (cmdHex === '06' || cmdHex === 'A0')) return 'IC卡账户余额(低16位)：' + yuan(balFen());
      return '第二滤芯实时寿命：' + F.f2;
    }
    function tF3() {
      if (isDown && cmdHex === '04') return '热水流量计(大通量/流量计1)每升脉冲数：' + F.f3 + ' 脉冲/升（100-8000）';
      if (isUp && cmdHex === '5E') return '自动校准热水流量计脉冲数：' + F.f3 + ' 脉冲/升';
      if (isUp && cmdHex === 'D0') return '手机号第1-2字节：' + hexOf(bytes, off.f3, 2);
      return '第三滤芯实时寿命：' + F.f3;
    }
    function tF4() {
      if (isUp && cmdHex === 'D0') return '手机号第3-4字节：' + hexOf(bytes, off.f4, 2);
      return '第四滤芯实时寿命：' + F.f4;
    }
    function tF5() {
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return '设备当前信号值(CSQ)：' + F.f5 + '/31';
      if (isUp && cmdHex === 'D0') return '手机号第5-6字节：' + hexOf(bytes, off.f5, 2);
      return '第五滤芯实时寿命：' + F.f5;
    }
    function iccidStr() { return hexOf(bytes, off.m1, 10); }
    function iccNo() { return u32(bytes, off.m1); }
    function tM1() {
      if (isDown && cmdHex === '04') return '单次消费最大放水时间：' + F.m1 + ' 秒';
      if (isDown && cmdHex === '80') return 'IC卡卡号(高16位)：' + iccNo().toString(16).toUpperCase() + '（42-45四字节=卡号）';
      if (isUp && (cmdHex === 'A0' || cmdHex === '90' || cmdHex === '06')) return 'IC卡卡号(高16位)：' + iccNo().toString(16).toUpperCase();
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return 'ICCID(第1-2字节)：' + iccidStr() + '（42-51十字节=20位ICCID）';
      if (isUp && cmdHex === 'D0') return '账户密码(高字节)：' + hexOf(bytes, off.m1, 2);
      return '第一滤芯寿命最大值：' + F.m1;
    }
    function tM2() {
      if (isDown && cmdHex === '04') return '放水阀1(热水阀,4分灌装泵)放水一升时间：' + F.m2 + ' 秒/升（10-800）';
      if (isDown && cmdHex === '80') return 'IC卡卡号(低16位)：' + iccNo().toString(16).toUpperCase();
      if (isUp && cmdHex === '5E') return '自动校准放水阀1(热水阀)放水一升时间：' + F.m2 + ' 秒/升';
      if (isUp && (cmdHex === 'A0' || cmdHex === '90' || cmdHex === '06')) return 'IC卡卡号(低16位)：' + iccNo().toString(16).toUpperCase();
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return 'ICCID(第3-4字节)：' + iccidStr();
      if (isUp && cmdHex === 'D0') return '账户密码(低字节)：' + hexOf(bytes, off.m2, 2);
      return '第二滤芯寿命最大值：' + F.m2;
    }
    function tM3() {
      if (isDown && cmdHex === '04') return '共享模式取水方式：' + (F.m3 === 0 ? '按键出水' : F.m3 === 1 ? '自动出水' : F.m3);
      if (isDown && cmdHex === '80') return '账户剩余流量：' + F.m3 + ' 升';
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return 'ICCID(第5-6字节)：' + iccidStr();
      return '第三滤芯寿命最大值：' + F.m3;
    }
    function tM4() {
      if (isDown && cmdHex === '04') {
        var b8 = F.m4 & 0xFF;
        var bits = (b8.toString(2).padStart(8, '0')).split('');
        var out = [];
        if (bits[3] === '0') out.push('冲洗=默认'); else out.push('冲洗=纯水冲洗');
        if (bits[4] === '0') out.push('浮球=2个'); else out.push('浮球=3个');
        if (bits[5] === '0') out.push('高液位=上浮断开'); else out.push('高液位=上浮导通');
        if (bits[6] === '0') out.push('中液位=上浮断开'); else out.push('中液位=上浮导通');
        if (bits[7] === '0') out.push('低液位=上浮断开'); else out.push('低液位=上浮导通');
        return '液位/冲洗位设置：' + out.join('，') + '（第49字节 0x' + b8.toString(16).toUpperCase() + '）';
      }
      if (isDown && cmdHex === '80') return '账户剩余天数：' + F.m4 + ' 天';
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return 'ICCID(第7-8字节)：' + iccidStr();
      return '第四滤芯寿命最大值：' + F.m4;
    }
    function tM5() {
      if (isUp && (cmdHex === '04' || cmdHex === 'EE')) return 'ICCID(第9-10字节)：' + iccidStr();
      return '第五滤芯寿命最大值：' + F.m5;
    }
    function tTime() {
      var v = F.time;
      if (isUp && cmdHex === '0C' && (F.state === 9 || F.state === 3)) {
        return '本次制水平均流速：' + ((v >> 16) & 0xFFFF) + ' ml/min（水满状态时52-53字节为流速）';
      }
      return '北京时间：' + secToHMS(v) + '（当日秒数 ' + v + '，0-86399）';
    }
    function tType() { return '机器类型：' + (TYPES[F.type] || F.type) + (isDown ? '（下发时该位为0）' : ''); }
    function tCs() {
      var sum = 0;
      for (var i = 0; i < bytes.length - 2; i++) sum += bytes[i];
      sum = sum & 0xFFFF;
      var ok = (sum === F.cs);
      return '校验和：' + (ok ? '✅ 通过' : '❌ 不通过') + '（计算=0x' + sum.toString(16).toUpperCase().padStart(4, '0') + '，报文=0x' + F.cs.toString(16).toUpperCase().padStart(4, '0') + '）';
    }

    /* 组装行 */
    function mk(k, fn) {
      var f = getField(k);
      var tr = fn();
      pushRow(f, fieldHex(k), F[k], tr);
    }
    mk('dev', tDev);
    mk('mode', tMode);
    mk('cmd', tCmd);
    mk('state', tState);
    mk('cur', tCur);
    mk('rcf', tRcf);
    mk('rcd', tRcd);
    mk('rmf', tRmf);
    mk('rmd', tRmd);
    mk('usf', tUsf);
    mk('usd', tUsd);
    mk('ptds', tPtds);
    mk('rTds', tRTds);
    mk('f1', tF1);
    mk('f2', tF2);
    mk('f3', tF3);
    mk('f4', tF4);
    mk('f5', tF5);
    mk('m1', tM1);
    mk('m2', tM2);
    mk('m3', tM3);
    mk('m4', tM4);
    mk('m5', tM5);
    mk('time', tTime);
    mk('type', tType);
    mk('cs', tCs);
    out.rows = rowList;

    /* ============ 概览 ============ */
    var summary = [
      { name: '包类型', value: kind },
      { name: '设备ID', value: String(F.dev) },
      { name: '计费模式', value: modeName },
      { name: '命令', value: cmdInfo ? cmdInfo.n + (isUp ? '（上报）' : '（下发）') : ('0x' + cmdHex + '（未收录）') },
      { name: '设备状态', value: stateName },
      { name: '北京时间', value: secToHMS(F.time) }
    ];
    var csOk = (function () { var s = 0; for (var i = 0; i < bytes.length - 2; i++) s += bytes[i]; return (s & 0xFFFF) === F.cs; })();
    summary.push({ name: '校验', value: csOk ? '✅ 通过' : '❌ 失败' });
    out.summary = summary;

    /* ============ 自然语言解读 ============ */
    out.speak = buildSpeak();
    out.ok = true;
    return out;

    function buildSpeak() {
      var s = [];
      var id = F.dev;
      var head = '设备(ID=' + id + ')';
      if (isUp) {
        switch (cmdHex.toLowerCase()) {
          case '00': s.push(head + '上报心跳包，设备在线。'); break;
          case '06': {
            s.push(head + '上报用水同步（一次用水行为）：本次出水总流量 ' + F.cur + ' ml（≈' + (F.cur / 1000).toFixed(3) + ' L），其中热水 ' + F.rcf + ' ml、冷水 ' + F.rcd + ' ml。');
            if (F.rmf && F.mode === 5) s.push('本次消费金额 ' + yuan(F.rmf) + '。');
            s.push('当前剩余流量 ' + F.rmf + ' L，剩余 ' + F.rmd + ' 天，已用 ' + F.usf + ' L；纯水TDS ' + F.ptds + ' ppm、原水TDS ' + F.rTds + ' ppm。');
            break;
          }
          case '0c': s.push(head + '上报设备状态变更：当前状态为「' + stateName + '」' + (F.state >= 30 ? '（故障/告警，请注意处理）' : '') + '。' + (F.state === 9 ? ' 当前制水中，平均制水流速约 ' + (((F.time >> 16) & 0xFFFF)) + ' ml/min。' : '')); break;
          case '04': s.push(head + '请求平台为其分配ID（设备编码请求），当前带信号值 CSQ=' + F.f5 + '/31，ICCID=' + iccidStr() + '。'); break;
          case 'ee': s.push(head + '上报设备信息回执：滤芯寿命按' + (F.state === 1 ? '流量' : '时间') + '计算；ICCID=' + iccidStr() + '；信号 CSQ=' + F.f5 + '/31。'); break;
          case 'a0': s.push(head + '上报刷卡识别请求：IC卡号 ' + iccNo().toString(16).toUpperCase() + '，卡内余额 ' + yuan(balFen()) + '，离线期间消费 ' + yuan(F.rmf) + '。'); break;
          case 'd0': s.push(head + '上报键盘输入的手机号与密码（无卡取水），手机号=' + hexOf(bytes, off.f3, 6) + '。'); break;
          case '5e': s.push(head + '上报自动校准流量系数完成：冷水流量计脉冲 ' + F.rcf + ' 脉冲/升、热水流量计脉冲 ' + F.f3 + ' 脉冲/升，放水阀1(热水) ' + F.m2 + ' 秒/升、放水阀2(冷水) ' + F.rcd + ' 秒/升，后台请同步更新。'); break;
          case 'cc': s.push(head + '上报错误包：此前收到的平台数据校验失败，平台应重发指令。'); break;
          default: {
            var r = CMDS[cmdHex.toLowerCase()];
            s.push(head + '回传「' + (r ? r.n : '0x' + cmdHex) + '」' + (r && r.t ? '（' + r.t + '）' : '') + '。');
          }
        }
        if (cmdHex.toLowerCase() !== '00' && cmdHex.toLowerCase() !== '06' && cmdHex.toLowerCase() !== '0c' && cmdHex.toLowerCase() !== '04' && cmdHex.toLowerCase() !== 'ee' && cmdHex.toLowerCase() !== 'a0' && cmdHex.toLowerCase() !== 'd0' && cmdHex.toLowerCase() !== '5e' && cmdHex.toLowerCase() !== 'cc') {
          var cm = CMDS[cmdHex.toLowerCase()];
          if (cm && cm.d === 'up' && /回执$/.test(cm.n)) {
            s.push('回执内容：剩余流量 ' + F.rmf + ' L、剩余 ' + F.rmd + ' 天、已用 ' + F.usf + ' L，北京时间 ' + secToHMS(F.time) + '。');
          }
        }
      } else {
        switch (cmdHex.toLowerCase()) {
          case '04': s.push('平台为设备(ID=' + id + ')下发「ID编码/设置机器参数」：' + (F.state === 1 ? '滤芯按流量计' : '滤芯按时间计') + '，冷水流量计 ' + F.rcf + ' 脉冲/升、冷水阀 ' + F.rcd + ' 秒/升、水泵制水 ' + F.rmf + ' 秒/升、加热最高 ' + F.usf + '℃、制冷最低 ' + F.usd + '℃、热水费率 ' + F.ptds + ' 毫升/分、冷水费率 ' + F.rTds + ' 毫升/分。'); break;
          case '05': s.push('平台向设备(ID=' + id + ')下发充值：' + (F.mode === 0 || F.mode === 4 ? '充值天数 ' + F.rcd + ' 天' : '充值流量 ' + F.rcf + ' L') + '，携带北京时间 ' + secToHMS(F.time) + '。'); break;
          case '07': s.push('平台向设备(ID=' + id + ')下发滤芯复位。'); break;
          case '09': s.push('平台向设备(ID=' + id + ')下发系统初始化：设剩余流量 ' + F.rmf + ' L、剩余天数 ' + F.rmd + ' 天、已用 ' + F.usf + ' L/' + F.usd + ' 天，北京时间 ' + secToHMS(F.time) + '。'); break;
          case '0b': s.push('平台向设备(ID=' + id + ')下发用时同步：剩余 ' + F.rmd + ' 天、已用 ' + F.usd + ' 天，北京时间 ' + secToHMS(F.time) + '。'); break;
          case '0d': s.push('平台向设备(ID=' + id + ')下发「查询设备信息」，请求设备回传最新状态。'); break;
          case '0e': s.push('平台向设备(ID=' + id + ')下发「获取信号/ICCID/机器配置参数」。'); break;
          case '80': s.push('平台向设备(ID=' + id + ')下发共享取水指令：本次允许流量 ' + F.rcf + ' ml、等待取水 ' + F.rcd + ' 秒、连续出水上限 ' + F.rmf + ' 秒，IC卡号 ' + iccNo().toString(16).toUpperCase() + '，卡内余额 ' + yuan(balFen()) + '，剩余 ' + F.m3 + ' L/' + F.m4 + ' 天。'); break;
          case '82': s.push('平台向设备(ID=' + id + ')下发设置：节能时间 ' + F.rcf + ' 分、加热启停温差 ' + F.rcd + '℃、浴霸1启动 ' + F.rmf + '℃/关闭温差 ' + F.usf + '℃、浴霸2启动 ' + F.rmd + '℃/关闭温差 ' + F.usd + '℃、臭氧周期 ' + F.f1 + ' 秒、臭氧内启动 ' + F.f2 + ' 秒。'); break;
          case '83': s.push('平台向设备(ID=' + id + ')下发设置广告灯工作时间：' + F.rcf + ' 分钟。'); break;
          case '84': s.push('平台向设备(ID=' + id + ')下发自动校准流量系数，校准流量 ' + F.cur + ' ml。'); break;
          default: {
            var cm2 = CMDS[cmdHex.toLowerCase()];
            s.push('平台向设备(ID=' + id + ')下发「' + (cm2 ? cm2.n : '0x' + cmdHex) + '」命令。');
          }
        }
      }
      s.push('（完整字段见下表）');
      return s.join('');
    }
  }

  /* 生成示例（运行时计算校验，保证正确） */
  function buildSample() {
    // 心跳：00002739
    var hb = '00002739';
    function p58(o) {
      // o: 各 key hex 字符串（无空格），自动按 layout 拼接；len 由 key 决定，缺失补0
      var parts = [];
      for (var i = 0; i < LAYOUT58.length - 1; i++) {   // 不含校验位
        var f = LAYOUT58[i];
        var hv = (o[f.k] || '');
        while (hv.length < f.len * 2) hv = '0' + hv;
        if (hv.length > f.len * 2) hv = hv.slice(hv.length - f.len * 2);
        parts.push(hv);
      }
      var s = parts.join('');
      var sum = 0;
      for (var j = 0; j < s.length; j += 2) sum += parseInt(s.substr(j, 2), 16);
      return s + (sum & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }
    var sample06 = p58({
      dev: '00002739', mode: '01', cmd: '06', state: '01',
      cur: '012c',            // 300ml 本次出水
      rcf: '00000000',        // 4B 热水=0（此例出冷水）
      rcd: '00c8',            // 200ml 冷水
      rmf: '00002710',        // 剩余 10000 L
      rmd: '0000',
      usf: '00000bb8',        // 已用 3000 L
      usd: '0000',
      ptds: '0032', rTds: '00c8',
      f1: '0000', f2: '0000', f3: '0000', f4: '0000', f5: '0000',
      m1: '0000', m2: '0000', m3: '0000', m4: '0000', m5: '0000',
      time: '0000cbe8',       // 14:30:00 → 52200=0xCBE8
      type: '00'
    });
    // 查询设备信息回执 0xDD
    var sampleDD = p58({
      dev: '00002739', mode: '02', cmd: 'DD', state: '01',
      cur: '0000',
      rcf: '00000000', rcd: '0000',
      rmf: '00013880',        // 剩余 80000 L
      rmd: '0000',
      usf: '0000c350',        // 已用 50000 L
      usd: '0000',
      ptds: '002a', rTds: '00fa',
      f1: '2710', f2: '1f40', f3: '1388', f4: '0fa0', f5: '05dc',   // 滤芯模式实时寿命(升)
      m1: '2710', m2: '2710', m3: '2710', m4: '2710', m5: '2710',   // 最大值 10000
      time: '0001e240',       // 123456s = 10:17:36
      type: '03'
    });
    return hb + '\n' + sample06 + '\n' + sampleDD;
  }

  /* ---------- 浏览器端 UI ---------- */
  function init() {
    var input = document.getElementById('ylPacketInput');
    var msgArea = document.getElementById('ylMsgArea');
    var resArea = document.getElementById('ylResultArea');
    var bodyEl = document.getElementById('ylBody');
    var speakEl = document.getElementById('ylSpeak');
    if (!input) return;

    function msg(html) { msgArea.innerHTML = html; }
    function parse() {
      var raw = input.value;
      var notes = [];
      if (!raw.trim()) { msg('<div class="error">⚠️ 请粘贴 TCP 原始传输数据（十六进制，可多行，每行一包）</div>'); hide(); return; }
      var lines = raw.split(/\r?\n/);
      var results = [], total = 0;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        if (!L.trim()) continue;
        var cleaned = cleanLine(L, 58);
        if (!cleaned.hex || cleaned.hex.length < 4) {
          notes.push('<div class="error">⚠️ 第 ' + (i + 1) + ' 行：未提取到十六进制数据（' + (L.length > 40 ? L.slice(0, 40) + '…' : L) + '）</div>');
          continue;
        }
        total++;
        var r = decode(L, 58);
        if (!r.ok) {
          notes.push('<div class="warning">⚠️ 第 ' + (i + 1) + ' 行：' + r.err + '</div>');
          continue;
        }
        results.push(r);
      }
      if (!results.length) {
        msg((notes.length ? notes.join('') : '') + '<div class="error">⚠️ 未解析出有效数据包</div>');
        hide();
        return;
      }
      var allHtml = '', allSpeak = '', allSummary = '';
      for (var j = 0; j < results.length; j++) {
        var r2 = results[j];
        allSummary += '<div class="packet-block" style="margin-top:' + (j ? '16px' : '0') + ';">';
        allSummary += '<div class="packet-title">📦 第 ' + (j + 1) + ' 条 · ' + (r2.kind === 'heart' ? '心跳包(4B)' : r2.kind) + '</div>';
        allSummary += '<div class="summary-box" style="margin-top:8px;"><h3 style="font-size:14px;">📋 报文概览</h3>';
        for (var k = 0; k < r2.summary.length; k++) allSummary += '<div class="summary-item"><span class="summary-label">' + r2.summary[k].name + '</span><span class="summary-value">' + r2.summary[k].value + '</span></div>';
        allSummary += '</div></div>';
        // 白话
        allSpeak += '<div class="packet-block" style="margin-top:12px;"><div class="packet-title">💬 ' + (r2.kind === 'heart' ? '心跳解读' : '白话解读') + '</div><div class="yl-nl">' + r2.speak + '</div></div>';
        // 字段表
        var tbl = '<table class="result-table"><thead><tr><th>字节位置</th><th>字段名称</th><th>十六进制</th><th>数值</th><th>中文白话说明</th></tr></thead><tbody>';
        for (var m = 0; m < r2.rows.length; m++) {
          var row = r2.rows[m];
          tbl += '<tr><td>' + row.pos + '</td><td><span class="field-name">' + row.name + '</span></td><td><span class="hex-value">' + row.hex + '</span></td><td>' + row.val + '</td><td><span class="translated">' + row.trans + '</span></td></tr>';
        }
        tbl += '</tbody></table>';
        allHtml += '<div class="packet-block" style="margin-top:16px;"><div class="packet-title">🔍 第 ' + (j + 1) + ' 条 · 字段明细' + (r2.kind === 'heart' ? '（心跳包仅4字节：设备ID）' : '') + '</div>' + tbl + '</div>';
      }
      // 概览框放顶部
      var summaryWrap = document.getElementById('ylSummary');
      if (summaryWrap) { summaryWrap.innerHTML = allSummary; summaryWrap.classList.remove('hidden'); }
      if (speakEl) { speakEl.innerHTML = allSpeak; }
      if (bodyEl) { bodyEl.innerHTML = allHtml; }
      if (resArea) resArea.classList.remove('hidden');
      msg(notes.join('') + '<div class="success">✅ 成功解析 ' + results.length + ' 条' + (errCount(notes) ? '，失败 ' + errCount(notes) + ' 行' : '') + '（共 ' + total + ' 行有效输入）</div>');
    }
    function errCount(notes) {
      var n = 0;
      for (var i = 0; i < notes.length; i++) if (notes[i].indexOf('⚠️') !== -1) n++;
      return n;
    }
    function hide() {
      if (resArea) resArea.classList.add('hidden');
    }
    var btn = document.getElementById('ylParseBtn');
    if (btn) btn.addEventListener('click', parse);
    var clearBtn = document.getElementById('ylClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      input.value = ''; msg(''); hide();
    });
    var exBtn = document.getElementById('ylExampleBtn');
    if (exBtn) exBtn.addEventListener('click', function () {
      input.value = buildSample();
      msg(''); parse();
    });
    // Ctrl+Enter 快捷键
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); parse(); }
    });
    if (typeof window.YLInitDone === 'undefined') { window.YLInitDone = true; }
    // 初次进入带示例（便于体验）
    if (!input.value.trim()) {
      input.value = buildSample();
      parse();
    }
  }

  function injectStyle() {
    var css = '' +
      '.yl-shell .packet-block{margin-top:16px;}' +
      '.yl-shell .packet-title{font-size:15px;font-weight:600;color:#3498db;margin-bottom:8px;}' +
      '.yl-shell .result-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;}' +
      '.yl-shell .result-table th{background:#f8f9fa;padding:8px 10px;text-align:left;font-weight:600;color:#2c3e50;border-bottom:2px solid #e8e8e8;white-space:nowrap;}' +
      '.yl-shell .result-table td{padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;}' +
      '.yl-shell .result-table tr:hover{background:#f8f9fa;}' +
      '.yl-shell .field-name{font-weight:600;color:#2c3e50;}' +
      '.yl-shell .hex-value{font-family:Consolas,Monaco,monospace;background:#f1f2f6;padding:1px 6px;border-radius:4px;font-size:12px;color:#e74c3c;white-space:nowrap;}' +
      '.yl-shell .translated{color:#27ae60;font-weight:500;}' +
      '.yl-shell .summary-box{background:#f8f9fa;border-radius:8px;padding:12px 16px;margin-top:10px;border-left:4px solid #3498db;}' +
      '.yl-shell .summary-item{display:inline-flex;align-items:center;gap:6px;margin:4px 14px 4px 0;}' +
      '.yl-shell .summary-label{color:#666;font-size:12px;}' +
      '.yl-shell .summary-value{font-weight:600;color:#2c3e50;font-size:12px;}' +
      '.yl-shell .yl-nl{font-size:14px;line-height:1.9;color:#333;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:10px 14px;}' +
      '.yl-shell .error{color:#e74c3c;background:#fdf2f2;padding:10px 12px;border-radius:8px;margin:6px 0;border-left:4px solid #e74c3c;font-size:13px;}' +
      '.yl-shell .warning{color:#f39c12;background:#fef9e7;padding:10px 12px;border-radius:8px;margin:6px 0;border-left:4px solid #f39c12;font-size:13px;}' +
      '.yl-shell .success{color:#27ae60;background:#eafaf1;padding:10px 12px;border-radius:8px;margin:6px 0;border-left:4px solid #27ae60;font-size:13px;}' +
      '.yl-shell textarea{width:100%;padding:10px 12px;border:1.5px solid #dcdde1;border-radius:8px;font-family:Consolas,Monaco,monospace;font-size:13px;resize:vertical;box-sizing:border-box;}' +
      '.yl-shell textarea:focus{outline:none;border-color:#3498db;}' +
      '.yl-shell .btn-group{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;}' +
      '.yl-shell .btn{border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;padding:9px 18px;color:#fff;}' +
      '.yl-shell .btn-primary{background:#3498db;}.yl-shell .btn-primary:hover{background:#2980b9;}' +
      '.yl-shell .btn-secondary{background:#95a5a6;}.yl-shell .btn-secondary:hover{background:#7f8c8d;}' +
      '.yl-shell .btn-success{background:#27ae60;}.yl-shell .btn-success:hover{background:#219a52;}' +
      '.yl-shell .hint{font-size:12px;color:#888;margin:4px 0 8px;line-height:1.7;}' +
      '.yl-shell .hidden{display:none;}' +
      '.yl-shell .card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px 20px;margin-bottom:14px;}' +
      '.yl-shell .card-title{font-size:16px;font-weight:600;color:#2c3e50;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #e8e8e8;}' +
      '@media (max-width:640px){.yl-shell .result-table{font-size:12px;}.yl-shell .btn{flex:1;}}';
    if (document.getElementById('ylDecodeStyle')) return;
    var st = document.createElement('style');
    st.id = 'ylDecodeStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  window.YLDecode = decode;
  window.YLBuildSample = buildSample;
  window.YLInit = function () { injectStyle(); init(); };
  // 页面加载即初始化（若面板存在）；node/无 DOM 环境则跳过
  if (typeof document !== 'undefined' && document.getElementById('ylPacketInput')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('ylPacketInput')) { injectStyle(); init(); }
      });
    } else {
      injectStyle();
      init();
    }
  }
})();
