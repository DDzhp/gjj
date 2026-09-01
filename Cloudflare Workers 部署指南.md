# Cloudflare Workers 云端代理部署指南（免本地代理）

> 目标：把云 OCR / 云二维码的转发逻辑部署到 Cloudflare 免费 Workers 上，
> **网页版直接调用云端地址，不用再启动本地代理**。密钥放在 Worker 环境变量（不公开）。
> 部署一次，永久使用；网页版只需填写一次代理地址（浏览器本地保存）。

---

## 1. 注册 / 登录 Cloudflare

打开 https://dash.cloudflare.com/sign-up 用邮箱注册（免费套餐即可，无需绑卡）。
已有账号直接登录 https://dash.cloudflare.com

## 2. 创建 Worker

1. 左侧菜单 → **Workers & Pages** → **创建** → **创建 Worker**
2. 输入名称（如 `ocr-proxy`，会生成地址 `https://ocr-proxy.<你的子域>.workers.dev`）
3. 点 **部署**（用默认 hello world 即可，后面会替换代码）

## 3. 粘贴代理代码

1. 在刚创建的 Worker 页面点 **编辑代码**（在线编辑器）
2. **全选删除**默认代码，粘贴仓库里 `cloud_ocr_worker.mjs` 的**全部内容**
3. 右上角点 **部署**

## 4. 设置密钥环境变量（关键）

左侧 **设置 → 变量和机密**（Settings → Variables）：

| 变量名 | 值 | 来源 |
|---|---|---|
| `BAIDU_API_KEY` | 百度 API Key | 百度智能云控制台 → 文字识别 → 应用列表 |
| `BAIDU_SECRET_KEY` | 百度 Secret Key | 同上（注意：应为 32 位十六进制） |
| `TENCENT_SECRET_ID` | 腾讯 SecretId | 腾讯云控制台 → 访问管理 → API 密钥管理 |
| `TENCENT_SECRET_KEY` | 腾讯 SecretKey | 同上 |

填完后点 **保存**，页面顶部提示「已更新的配置需要重新部署才能生效」→ 点 **部署** 重新部署一次。

> ⚠️ 如果当前百度密钥无效（之前实测 `invalid_client`），请先到百度控制台重新复制密钥再填。
> 填好前网页版可先只用「腾讯云」引擎（OCR + 二维码实测均可用）。

## 5. 获取代理地址

Worker 页面顶部显示：`https://ocr-proxy.<子域>.workers.dev`（点击可打开）。
直接访问该地址（GET 根路径）会返回 404 属正常，浏览器访问 `<地址>/ping` 应看到：
`{"ok":true,"engine":"cloud-worker",...}`

## 6. 网页版配置（一次性）

1. 打开线上工具集网页（https://gjj.cloud.yuelongxinxi.com 或本地 index.html）
2. 进入「二维码批量识别」工具
3. 在 **云端代理地址** 输入框填入 Worker 地址（如 `https://ocr-proxy.xxx.workers.dev`）
4. 点 **保存**，再点 **测试连接** → 应提示「代理连接成功 ✅」
5. 二维码引擎 / OCR 引擎下拉选「腾讯云」或「百度云」→ 选图开始识别

> 地址保存在浏览器 localStorage，**只需配置一次**，以后打开网页直接可用。

---

## 端点说明（与本地版 cloud_ocr_proxy.py 完全一致）

| 端点 | 云端服务 | 说明 |
|---|---|---|
| `GET /ping` | - | 健康检查 |
| `POST /ocr` | 百度 general_basic | OCR，自动纠偏旋转（竖排 IMEI 友好） |
| `POST /ocr_tencent` | 腾讯 GeneralBasicOCR | OCR（1000 次/月免费） |
| `POST /qr` | 腾讯 QrcodeOCR | 二维码识别（1000 次/月免费，实测 3/3） |
| `POST /qr_baidu` | 百度 qrcode | 二维码识别（500 次/月免费） |

## 免费额度

- **Cloudflare Workers**：免费套餐 10 万请求/天（本工具每次识别 = 1 次请求）
- **腾讯云**：OCR + 二维码各 1000 次/月（每月 1 号重置）
- **百度**：OCR 5 万次/天；二维码 500 次/月
- 用量大时本地引擎（jsQR/ZXing/Tesseract）完全免费不限额

## 本地代理（可选，已不再必需）

`cloud_ocr_proxy.py` 仍然保留可用。网页版「云端代理地址」填 `http://localhost:8765` 即切回本地模式。
两种代理端点完全兼容，随时切换，互不影响。

## 安全说明

- 密钥只在 Worker 环境变量中，**不进入网页代码、不公开**；浏览器只与 Worker 通信
- 任何打开网页的人都**无法**看到或盗用你的密钥（比「前端加密」安全得多）
- 若担心他人滥用你的 Worker，可在 Workers 后台开启 Access 或限制请求来源（进阶，按需）

## 故障排查

| 现象 | 处理 |
|---|---|
| 测试连接失败 | 核对地址是否以 `https://` 开头、无尾部斜杠；确认 Worker 已部署且代码已更新 |
| 识别报「腾讯密钥未配置」 | Worker 环境变量未填或未重新部署 |
| 百度引擎报 `Client authentication failed` | 百度密钥无效，去控制台重新复制 |
| 识别慢（10s+） | 腾讯 OCR 处理大图需数秒，正常；图片会被前端压缩到 2400px 再上传 |
