# -*- coding: utf-8 -*-
"""
生产订单批量识别脚本（云端双渠道：腾讯云 + 百度云，含各自解析统计 + 交叉互补合并）
用法: python batch_ocr.py <图片文件夹> [--engine both|tencent|baidu] [--sleep 0.8]
输出: <图片文件夹>/识别结果_时间戳/结果.xlsx + 识别报告.md
流程: 缩图(<=2400px) -> SCF 云 OCR 排队识别 -> node 解析器(order_resolver.js，三份解析) -> Excel/md
Excel 6 列: 原始图片 | 原始OCR内容 | 原始非标准内容(互补) | 标准内容(互补) | 腾讯云解析结果 | 百度云解析结果
"""
import os, sys, io, json, time, base64, argparse, subprocess, traceback
from datetime import datetime

import requests
from PIL import Image
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Font, PatternFill

HERE = os.path.dirname(os.path.abspath(__file__))
RESOLVER = os.path.join(HERE, 'order_resolver.js')
NODE = r'C:\Users\60969\.workbuddy\binaries\node\versions\22.22.2-6\node.exe'
SCF = 'https://1318636345-gylpu3x5zl.ap-guangzhou.tencentscf.com'
ENDPOINTS = {'tencent': '/ocr_tencent', 'baidu': '/ocr'}
NAMES = {'tencent': '腾讯云', 'baidu': '百度云'}
EXTS = {'.jpg', '.jpeg', '.png', '.bmp'}
MAX_SIDE = 2400          # 云端代理侧同款限制，防请求体过大
RETRY = 1                # 每渠道失败重试次数
SLEEP = 0.8              # 每次请求间隔（秒）

session = requests.Session()
session.trust_env = False  # 不走本机系统代理，SCF 国内直连
session.headers['Content-Type'] = 'text/plain'


def log(msg, logf=None):
    line = '[%s] %s' % (datetime.now().strftime('%H:%M:%S'), msg)
    print(line)
    if logf:
        logf.write(line + '\n')
        logf.flush()


def shrink_to_b64(path):
    """图片压到最长边<=2400 并转 JPEG base64（云端渠道同款预处理）"""
    im = Image.open(path)
    im = im.convert('RGB')
    w, h = im.size
    if max(w, h) > MAX_SIDE:
        r = MAX_SIDE / float(max(w, h))
        im = im.resize((int(w * r), int(h * r)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode('ascii'), im.size


def call_cloud(engine, b64, logf):
    """单渠道识别，带重试；返回 (text, err)"""
    err = None
    for attempt in range(1 + RETRY):
        try:
            r = session.post(SCF + ENDPOINTS[engine], data=b64.encode('ascii'), timeout=90)
            j = r.json()
            if isinstance(j, dict) and j.get('text'):
                return j['text'], None
            err = str(j.get('error') if isinstance(j, dict) else j)[:120]
        except Exception as e:
            err = repr(e)[:120]
        if attempt < RETRY:
            time.sleep(1.5)
    return '', err


def resolve(payload):
    """调 node 解析器：双渠道文本 -> 三份解析（腾讯/百度/互补合并）"""
    p = subprocess.run([NODE, RESOLVER], input=payload.encode('utf-8'),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf-8', 'ignore')[:200])
    return json.loads(p.stdout.decode('utf-8'))


def make_thumb(path, out_png, width=300):
    im = Image.open(path)
    im = im.convert('RGB')
    w, h = im.size
    if w > width:
        im = im.resize((width, int(h * width / float(w))), Image.LANCZOS)
    im.save(out_png, 'PNG')
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', help='订单图片文件夹')
    ap.add_argument('--engine', default='both', choices=['both', 'tencent', 'baidu'])
    ap.add_argument('--sleep', type=float, default=SLEEP)
    args = ap.parse_args()

    folder = os.path.abspath(args.folder)
    if not os.path.isdir(folder):
        print('文件夹不存在: ' + folder)
        sys.exit(1)
    files = sorted(f for f in os.listdir(folder)
                   if os.path.splitext(f)[1].lower() in EXTS
                   and not f.startswith('~$'))
    if not files:
        print('文件夹内没有图片(jpg/png/bmp): ' + folder)
        sys.exit(1)

    outdir = os.path.join(folder, '识别结果_' + datetime.now().strftime('%Y%m%d_%H%M%S'))
    os.makedirs(outdir, exist_ok=True)
    engines = ['tencent', 'baidu'] if args.engine == 'both' else [args.engine]

    logf = open(os.path.join(outdir, '运行日志.txt'), 'w', encoding='utf-8')
    log('共 %d 张图片，渠道: %s，输出: %s' % (len(files), '+'.join(engines), outdir), logf)

    rows = []  # 每单结果
    for idx, fn in enumerate(files, 1):
        path = os.path.join(folder, fn)
        row = {'file': fn, 'ocr': {}, 'pick': '', 'res': None, 'error': '', 'secs': 0}
        t0 = time.time()
        try:
            b64, size = shrink_to_b64(path)
            for eng in engines:
                time.sleep(args.sleep)
                txt, err = call_cloud(eng, b64, logf)
                row['ocr'][eng] = {'text': txt, 'error': err}
                log('  [%d/%d] %s %s: %d 字%s' % (idx, len(files), NAMES[eng], fn,
                    len(txt), '（失败:' + err + '）' if err else ''), logf)
            # 主选渠道：第一个有结果的
            for eng in engines:
                if row['ocr'][eng]['text']:
                    row['pick'] = eng
                    break
            if row['pick']:
                payload = {
                    'tencent': row['ocr'].get('tencent', {}).get('text', ''),
                    'baidu': row['ocr'].get('baidu', {}).get('text', ''),
                    'pick': row['pick'],
                }
                res = resolve(json.dumps(payload, ensure_ascii=False))
                row['res'] = res
            else:
                row['error'] = '两渠道均未识别到文字'
        except Exception as e:
            row['error'] = repr(e)[:200]
            log('  [%d/%d] %s 异常: %s' % (idx, len(files), fn, row['error']), logf)
        row['secs'] = round(time.time() - t0, 1)
        rows.append(row)
        m = (row['res'] or {}).get('merged') or {}
        log('  [%d/%d] %s 完成 %.1fs 标准内容:%s 补字段:%s' % (
            idx, len(files), fn, row['secs'],
            '有' if m.get('standard') else '无',
            '、'.join(m.get('mergedKeys', [])) or '-'), logf)

    # ---- Excel 6 列：图片 | OCR原文 | 非标(互补) | 标准(互补) | 腾讯云解析 | 百度云解析 ----
    wb = Workbook()
    ws = wb.active
    ws.title = '订单识别结果'
    headers = ['原始图片内容', '图片名称', '原始OCR内容', '原始非标准内容（互补）', '标准内容（互补）',
               '腾讯云解析结果（单渠道）', '百度云解析结果（单渠道）']
    hfill = PatternFill('solid', fgColor='2F5597')
    for c, htxt in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c, value=htxt)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = hfill
        cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 24
    widths = [46, 24, 68, 52, 60, 48, 48]
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + c)].width = w
    wrap_top = Alignment(wrap_text=True, vertical='top')
    tmpdir = os.path.join(outdir, '_thumbs')
    os.makedirs(tmpdir, exist_ok=True)
    for i, row in enumerate(rows):
        r = i + 2
        ws.row_dimensions[r].height = 170
        res = row['res'] or {}
        merged = res.get('merged') or {}
        c1 = ws.cell(row=r, column=1)
        c1.alignment = wrap_top
        cb = ws.cell(row=r, column=2, value=row['file'])  # 图片名称列
        cb.alignment = wrap_top
        try:
            tp = os.path.join(tmpdir, '%03d.png' % i)
            make_thumb(os.path.join(folder, row['file']), tp)
            img = XLImage(tp)
            img.width, img.height = 220, 155
            ws.add_image(img, 'A%d' % r)
        except Exception as e:
            c1.value = '(缩略图失败: %s)' % repr(e)[:60]
        ocr_main = ''
        if row['pick']:
            ocr_main = '【%s】\n' % NAMES[row['pick']] + row['ocr'][row['pick']]['text']
            other = [e for e in engines if e != row['pick']]
            if other:
                o = row['ocr'][other[0]]
                ocr_main += '\n\n――― %s ―――\n' % NAMES[other[0]] + (o['text'] or ('识别失败: ' + (o['error'] or '')))
        elif row['ocr']:
            ocr_main = '\n\n'.join('【%s】%s' % (NAMES[e], (row['ocr'][e]['error'] or '未识别到文字'))
                                    for e in engines)
        c2 = ws.cell(row=r, column=3, value=ocr_main)
        c2.alignment = wrap_top
        c3 = ws.cell(row=r, column=4, value=merged.get('nonStandard', ''))
        c3.alignment = wrap_top
        std_m = merged.get('standard', '')
        c4 = ws.cell(row=r, column=5, value=std_m or ('<未生成>' + ((' ' + row['error']) if row['error'] else '')))
        c4.alignment = wrap_top
        if std_m and merged.get('mergedKeys'):
            c4.value = std_m + '\n〔互补补充: ' + '、'.join(merged['mergedKeys']) + '〕'
        # 单渠道解析列：标准内容 + 字段数
        for col, eng in ((6, 'tencent'), (7, 'baidu')):
            single = res.get(eng)
            if single:
                txt = single['standard'] or '<未解析出参数>'
                txt = '已识别 %d 项: %s\n未识别 %d 项\n―――\n%s' % (
                    len(single['filled']), '、'.join(single['filled']) or '-',
                    len(single['missing']), txt)
                if single['warnings']:
                    txt += '\n⚠ ' + '；'.join(single['warnings'])
            elif eng in engines:
                o = row['ocr'].get(eng, {})
                txt = '识别失败' + ((':' + o['error']) if o.get('error') else '（未识别到文字）')
            else:
                txt = '未启用该渠道'
            cc = ws.cell(row=r, column=col, value=txt)
            cc.alignment = wrap_top
    xlsx = os.path.join(outdir, '结果.xlsx')
    wb.save(xlsx)
    log('Excel 已保存: ' + xlsx, logf)

    # ---- md 报告：汇总表 + 每单三节（腾讯/百度/互补） ----
    ok_std = sum(1 for x in rows if (x['res'] or {}).get('merged', {}).get('standard'))
    lines = ['# 生产订单批量识别报告', '',
             '- 时间: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
             '- 图片文件夹: ' + folder,
             '- 图片总数: %d' % len(rows),
             '- 标准内容生成（互补）: %d / %d' % (ok_std, len(rows)),
             '- 渠道: ' + ' + '.join(NAMES[e] for e in engines),
             '- 云代理: ' + SCF, '',
             '| # | 文件 | 主渠道 | 腾讯解析 | 百度解析 | 互补标准 | 互补补充字段 | 耗时s |',
             '|---|------|--------|----------|----------|----------|--------------|-------|']
    for i, row in enumerate(rows, 1):
        res = row['res'] or {}
        merged = res.get('merged') or {}
        t_n = str(len(res['tencent']['filled'])) + '项' if res.get('tencent') else '-'
        b_n = str(len(res['baidu']['filled'])) + '项' if res.get('baidu') else '-'
        lines.append('| %d | %s | %s | %s | %s | %s | %s | %s |' % (
            i, row['file'], NAMES.get(row['pick'], '-'),
            t_n, b_n,
            ('√（%d项）' % len(merged['filled'])) if merged.get('standard') else '×',
            '、'.join(merged.get('mergedKeys', [])) or '-',
            row['secs']))
    lines.append('')
    for i, row in enumerate(rows, 1):
        res = row['res'] or {}
        merged = res.get('merged') or {}
        lines.append('## %d. %s' % (i, row['file']))
        lines.append('')
        for eng in engines:
            single = res.get(eng)
            lines.append('### %s 单渠道解析' % NAMES[eng])
            o = row['ocr'].get(eng, {})
            if o.get('error'):
                lines.append('- 识别失败: ' + o['error'])
            elif not single:
                lines.append('- 未识别到文字' if eng in engines else '- 未启用该渠道')
            else:
                lines.append('- 已识别(%d项): %s' % (len(single['filled']), '、'.join(single['filled']) or '-'))
                lines.append('- 未识别(%d项): %s' % (len(single['missing']), '、'.join(single['missing']) or '-'))
                if single['warnings']:
                    lines.append('- 警告: ' + '；'.join(single['warnings']))
                lines.append('- 标准内容: ' + (single['standard'] or '<未解析出参数>'))
            lines.append('')
        lines.append('### 交叉互补合并结果（主渠道: %s）' % (merged.get('base', '-') if merged else '-'))
        if merged:
            lines.append('- 已识别(%d项): %s' % (len(merged['filled']), '、'.join(merged['filled']) or '-'))
            lines.append('- 未识别(%d项): %s' % (len(merged['missing']), '、'.join(merged['missing']) or '-'))
            if merged.get('mergedKeys'):
                lines.append('- **互补补充字段: %s**' % '、'.join(merged['mergedKeys']))
            if merged['warnings']:
                lines.append('- 警告: ' + '；'.join(merged['warnings']))
            lines.append('- 标准内容: ' + (merged['standard'] or '<未解析出参数>'))
            lines.append('- 非标摘要: ' + (merged['nonStandard'] or '-'))
        else:
            lines.append('- ' + (row['error'] or '无可解析文本'))
        lines.append('')
        for eng in engines:
            o = row['ocr'].get(eng, {})
            lines.append('<details><summary>%s 原文（%d 字%s）</summary>' % (
                NAMES[eng], len(o.get('text', '')),
                '，失败: ' + o['error'] if o.get('error') else ''))
            lines.append('')
            lines.append('```')
            lines.append(o.get('text', '') or '（无）')
            lines.append('```')
            lines.append('</details>')
        lines.append('')
    md = os.path.join(outdir, '识别报告.md')
    with open(md, 'w', encoding='utf-8') as fp:
        fp.write('\n'.join(lines))
    log('md 报告已保存: ' + md, logf)
    log('全部完成: %d/%d 生成标准内容（互补），明细见报告' % (ok_std, len(rows)), logf)
    logf.close()


if __name__ == '__main__':
    main()
