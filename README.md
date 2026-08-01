# 统一工具集

纯前端单页工具集：脉冲计算、进制转换、ICCID 解析、二维码生成与识别、日志分析、拍照强化、倒计时 等一站式工具。无需后端，直接用浏览器打开 `index.html` 或 `工具集.html` 即可使用。

## 目录结构

```
工具集/
├── index.html            入口页（与 工具集.html 内容一致）
├── 工具集.html           入口页（别名）
├── css/                  design-system.css / scan.css 等样式
├── js/                   核心脚本
│   ├── app.shell.js      应用外壳：导航、工具切换、搜索、密钥门
│   ├── tools.meta.js     工具元数据（名称/图标/分类）
│   ├── tools.main-a.js   工具业务逻辑（A）
│   ├── tools.main-b.js   工具业务逻辑（B）
│   ├── tools.qrbatch-init.js  批量二维码初始化
│   ├── app.compat.js     兼容性补丁
│   ├── logDecode.js      日志解码
│   ├── zxing.min.js      二维码识别库（本地）
│   ├── jquery-3.6.0.min.js / xlsx.full.min.js / jszip.min.js / tesseract.min.js / ocrad.js
│   └── photoEnhance*.js  拍照强化相关
├── vendor/               jszip.min.js / opencv.js 等第三方库
├── tishiyin.mp3          倒计时提示音
├── favicon.svg           站点图标
├── ic卡入库模板.xls       入库模板
├── AA-模板-*.md           后台对接模板说明
├── 入库参数生成.html / 入库参数解析.html / 解析二维码.html / 倒计时工具.html / djs.html / daohang.html
├── sync.bat              一键同步到 GitHub 的脚本
└── .gitignore            忽略内部目录（.codebuddy / .playwright-cli / zxtest）
```

## 密钥门

「qy日志分析」与「📊 日志分析器」两个工具需要访问密钥才能使用：

- 打开工具会先弹出密钥输入框。
- 密钥固定为 `983123`，输入正确后点击「解锁」即可进入。
- 实现位于 `js/app.shell.js` 的 `initKeyGate()`（已挂载到 `window`，由 `showTool()` 触发）。

> 其他工具（倒计时、二维码、入库参数等）不受密钥限制，可直接访问。

## 本地运行

直接双击 `index.html` 或 `工具集.html` 即可。建议用本地静态服务器（如 VS Code Live Server）打开，以避免个别浏览器对 `file://` 下的脚本/音频限制。

## 同步到 GitHub（gjj 仓库）

本目录是 **独立的 git 仓库**，远程为 `https://github.com/DDzhp/gjj.git`，分支 `main`。

### 方法一：双击 sync.bat（推荐）

1. 修改完任意文件后，双击 `sync.bat`。
2. 按提示输入本次改动说明（直接回车使用默认说明）。
3. 脚本自动执行 `git add -A` → `commit` → `git push origin main`。

### 方法二：IDE 快捷键（VS Code / CodeBuddy）

用编辑器打开 `工作\工具集` 这个文件夹本身（不要打开上层 `11-模板`，否则会进到外层仓库）：

- `Ctrl+Shift+G`：打开源代码管理面板
- 输入说明后 `Ctrl+Enter`：提交
- 点击面板上的同步/云朵图标（或 `Ctrl+Shift+P` → `>git push`）：推送
- `Ctrl+Shift+P` → `>git pull`：拉取最新

### 命令行

```bash
cd "F:\ylgongzuo\对接文档\11-模板\工作\工具集"
git add .
git commit -m "描述本次改动"
git push origin main
```

## 注意事项

- **代理**：git 已配置代理 `http://127.0.0.1:10809`。只有在挂代理时能连通 GitHub；关代理后 `push` 会超时。需要去掉代理时执行：
  ```bash
  git config --unset http.proxy
  git config --unset https.proxy
  ```
- **独立仓库**：`工作\工具集` 与外层的 `11-模板` 仓库互不相干。不要在 `11-模板` 那一层 `git add 工作/工具集`，否则会被识别为子模块（submodule）导致混乱。
- **忽略项**：`.codebuddy/`、`.playwright-cli/`、`zxtest/` 已被 `.gitignore` 排除，不会进入仓库。
