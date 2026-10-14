// 订单解析 CLI：stdin 读 JSON {tencent, baidu, pick} 或纯文本
// 输出三份解析：tencent（腾讯云单独）、baidu（百度云单独）、merged（交叉互补合并）
// 复用 tools.main-a.js 已验证的解析核心（116 断言回归保证），零依赖
const fs = require('fs');
const MAIN = 'F:/ylgongzuo/对接文档/11-模板/工作/工具集/js/tools.main-a.js';
const src = fs.readFileSync(MAIN, 'utf8');

const a = src.indexOf('// === ORDER_PARSE_BEGIN ===');
const b = src.indexOf('// === ORDER_PARSE_END ===');
if (a < 0 || b < 0) { console.error('parse block not found'); process.exit(1); }
eval(src.slice(a, b));

const bi = src.indexOf('function buildOrderExtractText');
const bend = src.indexOf('function parseOrderText()');
eval(src.slice(bi, bend));

// 标准内容：复刻 extractData 拼接规则（【五要素。】+ 非空参数按顺序）
function buildStandardText(F) {
    const parts = [];
    const comp = (F.company || '').replace(/[,，、\s]+$/, '');
    const wx = ((F.wechat || comp) || '').replace(/[,，、\s]+$/, '');
    const five = [comp, wx, '无卡类型', F.vendorId || '', F.platform || ''].filter(function (v) { return v !== ''; });
    const excelResult = five.length ? '【' + five.join('，') + '。】' : '';
    if (F.model) parts.push('主板型号：' + F.model);
    if (F.filterLife) parts.push('滤芯寿命：' + (F.filterLife === '0' ? '0.时间' : '1.流量'));
    if (F.channel2Pulse) parts.push('通道2脉冲[冷、小2]：' + F.channel2Pulse);
    if (F.channel1Pulse) parts.push('通道1脉冲[热,大]：' + F.channel1Pulse);
    if (F.waterTime) parts.push('制水时间：' + F.waterTime);
    if (F.valve2) parts.push('阀2放水时间[冷、小]：' + F.valve2);
    if (F.valve1 || F.valve2) parts.push('阀1放水时间[罐装、大、热]：' + (F.valve1 || F.valve2));
    if (F.maintainTime) parts.push('检修 时间：' + F.maintainTime);
    if (F.hotWaterTemp) parts.push('热水 温度：' + F.hotWaterTemp);
    if (F.coolStartTemp) parts.push('制冷启动温度：' + F.coolStartTemp);
    if (F.disinfectionWait) parts.push('温度锁定、消毒后等待：' + F.disinfectionWait);
    if (F.disinfectionDuration) parts.push('消毒持续时间：' + F.disinfectionDuration);
    if (F.rate1Hot) parts.push('大/1通道/热水老费率：' + F.rate1Hot);
    if (F.rate2Cold) parts.push('小/2通道/冷水老费率：' + F.rate2Cold);
    if (F.rate1) parts.push('大/1通道/热水费率：' + F.rate1);
    if (F.rate2) parts.push('小/2通道/冷水费率：' + F.rate2);
    if (F.singleLimitFlow) parts.push('单次限制流量/箱3：' + F.singleLimitFlow);
    if (F.waterWait) parts.push('取水等待时间：' + F.waterWait);
    if (F.waterPause) parts.push('取水暂停等待时间：' + F.waterPause);
    if (F.floatBall) parts.push('浮球-派士：' + F.floatBall);
    if (F.singleLimitTime) parts.push('单次限制时间：' + F.singleLimitTime);
    if (F.count) parts.push('入库数量：' + F.count);
    const paramResult = parts.length ? parts.join('，') + '。' : '';
    return excelResult + paramResult;
}

function parseOne(text) {
    if (!text || !String(text).trim()) return null;
    const F = parseOrderTextCore(text);
    return {
        fields: F,
        filled: F.filled,
        missing: F.missing,
        warnings: F.warnings,
        nonStandard: buildOrderExtractText(F),
        standard: buildStandardText(F)
    };
}

const input = fs.readFileSync(0, 'utf8').trim();
let tencentText = '', baiduText = '', pick = '';
if (input.startsWith('{')) {
    try {
        const j = JSON.parse(input);
        tencentText = j.tencent || '';
        baiduText = j.baidu || '';
        pick = j.pick || '';
    } catch (e) { tencentText = input; }
} else {
    tencentText = input; // 兼容纯文本
}

const T = parseOne(tencentText);
const B = parseOne(baiduText);

// 交叉互补合并：pick 指定主渠道（默认腾讯），主缺副有则补
// 注意：merge 在 baseF 的深拷贝上进行，保持 tencent/baidu 单渠道统计纯净不被污染
let merged = null;
let baseF = null, otherF = null, baseName = '', otherName = '';
if (pick === 'baidu' && B) { baseF = JSON.parse(JSON.stringify(B.fields)); otherF = T ? T.fields : null; baseName = '百度云'; otherName = '腾讯云'; }
else if (T) { baseF = JSON.parse(JSON.stringify(T.fields)); otherF = B ? B.fields : null; baseName = '腾讯云'; otherName = '百度云'; }
else if (B) { baseF = JSON.parse(JSON.stringify(B.fields)); otherF = null; baseName = '百度云'; otherName = ''; }

if (baseF) {
    const mergedKeys = [];
    if (otherF) {
        const LABELS = { company: '公司名称', wechat: '微信公众号名称', vendorId: '厂商账号', model: '产品型号', count: '产品数量', channel2Pulse: '冷水2路脉冲', channel1Pulse: '热水1路脉冲', waterTime: '制水时间', valve2: '放水时间冷2路', valve1: '放水时间热1路', maintainTime: '检修时间', hotWaterTemp: '加热最高温度', coolStartTemp: '制冷启动温度', floatBall: '浮球', singleLimitFlow: '单次限制流量', waterWait: '取水等待时间', waterPause: '取水暂停等待时间', singleLimitTime: '单次限制时间', rate2: '冷水费率2路', rate1: '热水费率1路', disinfectionWait: '消毒后等待时间', disinfectionDuration: '消毒持续时间', filterLife: '滤芯寿命', platform: '云平台' };
        Object.keys(LABELS).forEach(function (k) {
            if ((baseF[k] === undefined || baseF[k] === '') && otherF[k] !== undefined && otherF[k] !== '') {
                baseF[k] = otherF[k];
                mergedKeys.push(LABELS[k]);
                const lb = LABELS[k];
                const mi = baseF.missing.indexOf(lb);
                if (mi >= 0) baseF.missing.splice(mi, 1);
                let disp = String(otherF[k]);
                if (k === 'filterLife') disp = '滤芯寿命(' + (otherF[k] === '0' ? '时间' : '流量') + ')';
                if (k === 'platform') disp = '云平台(' + otherF[k] + ')';
                baseF.filled.push(disp + '<' + otherName + '补>');
                baseF.warnings.push(lb + ' ' + baseName + '未识别，已从' + otherName + '补（建议人工核对）');
                if (k === 'filterLife') baseF.warnings = baseF.warnings.filter(function (w) { return w.indexOf('滤芯寿命勾选未识别') === -1; });
                if (k === 'platform') baseF.warnings = baseF.warnings.filter(function (w) { return w.indexOf('云平台勾选未识别') === -1; });
            }
        });
    }
    merged = {
        fields: baseF,
        filled: baseF.filled,
        missing: baseF.missing,
        warnings: baseF.warnings,
        mergedKeys: mergedKeys,
        base: baseName,
        nonStandard: buildOrderExtractText(baseF),
        standard: buildStandardText(baseF)
    };
}

process.stdout.write(JSON.stringify({ tencent: T, baidu: B, merged: merged }));
