# 腾讯云 SCF 云函数云端代理部署指南（免本地代理）

> 目标：把云 OCR / 云二维码的转发逻辑部署到**腾讯云 SCF 云函数**（Serverless），
> **网页版直接调用云端地址，不用再启动本地代理**。密钥放在函数环境变量（不公开）。
> 部署一次，永久使用；网页版只需填写一次代理地址（浏览器本地保存）。

---

## 0. 为什么是 SCF（而不是 EdgeOne 边缘函数）

EdgeOne 边缘函数链路太长、坑太多（已实测放弃）：

- 需要：建站点 → 加加速域名 → DNS CNAME → 配 HTTPS 证书 → 配触发规则（且规则必须带 HOST 条件才匹配自定义域名）
- 大陆 IP 访问默认域名 `*.eo-edgefunctions.com` 会被强制下载（Content-Disposition: attachment）
- 实测始终 `HTTP 522`，请求回落 origin（nas.520why.top，不可达）→ 超时

**SCF「函数 URL」是云函数自带的公网 HTTP(S) 端点，创建即用**：

- 无需站点、域名、CNAME、证书、触发规则
- 天然 HTTPS，浏览器直接访问
- 免费额度长期有效（见文末）

---

## 1. 准备 4 个密钥（一次性）

从 `config.json` 复制，后面第 4 步粘贴进环境变量：

| 变量名 | 当前值（示例，以 config.json 为准） | 来源 |
|---|---|---|
| `BAIDU_API_KEY` | `（从本地 config.json 复制，勿公开）` | 百度智能云 → 文字识别 → 应用列表 |
| `BAIDU_SECRET_KEY` | `（从本地 config.json 复制，勿公开）` | 同上 |
| `TENCENT_SECRET_ID` | `（从本地 config.json 复制，勿公开）` | 腾讯云控制台 → 访问管理 → API 密钥管理 |
| `TENCENT_SECRET_KEY` | `（从本地 config.json 复制，勿公开）` | 同上 |

> ⚠️ 若百度密钥曾报 `invalid_client`，先到百度控制台重新复制再填。

## 2. 创建空白函数

1. 打开 https://console.cloud.tencent.com/scf （控制台搜「云函数」）
2. 左侧 **函数服务** → 点 **新建**
3. 创建方式选 **空白函数**；函数类型 **事件函数**；运行环境 **Python 3.9**（3.6~3.10 均可）
4. 地域随意（推荐 **ap-guangzhou** 广州，离本机近、延迟低）
5. 提交创建

## 3. 粘贴代理代码

1. 进入刚创建的函数 → 点 **编辑** → 打开 **index.py**（在线编辑器）
2. 全选删除默认代码，粘贴仓库里 `cloud_ocr_scf.py` 的**全部内容**
3. 执行方法填 **`index.main_handler`**
4. 点 **部署**（右上角）

## 4. 设置超时时间（关键，否则大图必超时）

函数配置 → **配置** → 把 **超时时间** 改为 **60 秒**（默认 3 秒不够 OCR 大图）

## 5. 添加 4 个环境变量（密钥）

函数配置 → **配置** → **环境变量** → 添加第 1 步那 4 项 → 保存后**重新部署**一次生效。

## 6. 创建函数 URL 触发器（核心一步，替代 EdgeOne 全部域名/证书/规则配置）

1. 进入函数 → **触发管理** → **创建触发器**
2. 触发器类型选 **函数 URL**（Function URL）
3. 访问方式选 **公开（无需鉴权）**
4. 提交

创建后页面会直接给一个公网 URL，形如：

- `https://xxx.ap-guangzhou.app.tcloudbase.com/` 或
- `https://xxx-service-xxx.gz.apigw.tencentcs.com/`（API 网关形态）

**把这个 URL 复制下来备用**，不需要任何 DNS / 证书 / 规则操作。

## 7. 验证

浏览器直接打开：

```
<函数URL>/ping
```

应看到：

```json
{"ok": true, "engine": "scf", "time": "2026-09-02 14:24:49"}
```

> 注意：部分形态的函数 URL 需拼接子路径才命中，若 `/ping` 404 且根路径可达，
> 通常是函数 URL 自带前缀（如 `/release/`），网页版填前缀地址即可，两端点路由会自动兜底匹配。

## 8. 网页版配置（一次性）

1. 打开线上工具集网页（https://gjj.cloud.yuelongxinxi.com 或本地 index.html）
2. 进入「二维码批量识别」工具
3. 在 **云端代理地址** 输入框填入函数 URL（**不带尾部斜杠**）
4. 点 **保存**，再点 **测试连接** → 应提示「代理连接成功 ✅」
5. 二维码 / OCR 引擎下拉选「腾讯云」或「百度云」→ 选图开始识别

> 地址保存在浏览器 localStorage，**只需配置一次**，以后打开网页直接可用。

---

## 端点说明（与本地版 cloud_ocr_proxy.py 完全一致）

| 端点 | 云端服务 | 说明 |
|---|---|---|
| `GET /ping` | - | 健康检查 |
| `POST /ocr` | 百度 general_basic | OCR，自动纠偏旋转（竖排 IMEI 友好） |
| `POST /ocr_numbers` | 百度 v1/numbers | 纯数字识别（免费 200 次/天） |
| `POST /ocr_tencent` | 腾讯 GeneralBasicOCR | OCR（1000 次/月免费） |
| `POST /qr` | 腾讯 QrcodeOCR | 二维码识别（1000 次/月免费） |
| `POST /qr_baidu` | 百度 qrcode | 二维码识别（500 次/月免费） |

## 免费额度

- **SCF 云函数本身**：每月 40 万 GBs 资源使用量 + **100 万次调用**免费（长期有效，个人使用远用不完）
- **腾讯云 OCR**：1000 次/月免费（每月 1 号重置）
- **百度 OCR**：5 万次/天；数字识别 200 次/天；二维码 500 次/月
- 用量大时本地引擎（jsQR/ZXing/Tesseract）完全免费不限额

## 本地代理（可选，已不再必需）

`cloud_ocr_proxy.py` 仍然保留可用。网页版「云端代理地址」填 `http://localhost:8765` 即切回本地模式。
两种代理端点完全兼容，随时切换，互不影响。

## 安全说明

- 密钥只在 SCF 环境变量中，**不进入网页代码、不公开**；浏览器只与函数 URL 通信
- 任何打开网页的人都**无法**看到或盗用你的密钥
- 若担心他人滥用，可把触发器访问方式改为「私有」并用腾讯云 API 网关鉴权（进阶，按需）

## 故障排查

| 现象 | 处理 |
|---|---|
| 测试连接失败 | 核对地址以 `https://` 开头、无尾部斜杠；确认函数已部署且环境变量已生效 |
| `/ping` 404 | 函数 URL 可能带路径前缀，在控制台「触发管理」查看完整访问路径 |
| 识别报 500 `image format error` | ⚠️ **SCF 函数 URL 平台对二进制 multipart/form-data 请求体有损**（实测无论边界写法必坏）。网页版已统一改为 **base64 文本上传**（`Content-Type: text/plain`，body 为图片 base64，纯 ASCII 无损）。若自研客户端调用，请同样用 base64 文本格式 POST，勿用 FormData multipart |
| 识别超时（10s+ 报网关超时） | 函数配置 → 超时时间没改成 60 秒 |
| 报「密钥未配置」 | 4 个环境变量没填全，或填完没重新部署 |
| 百度引擎报 `Client authentication failed` | 百度密钥无效，去控制台重新复制 |
| 腾讯引擎报签名错误 | `TENCENT_SECRET_ID / TENCENT_SECRET_KEY` 填反或复制不全（去掉首尾空格） |

---

## 附录：EdgeOne 方案状态（已放弃，留档备忘）

- 站点：520why.top（zone 3uiargdkoqea）；函数：`ocr-proxy-zone-3uiargdkoqea-1318636345`
- 加速域名 `ocr.520why.top` + HTTPS 证书均已配置生效
- 触发规则 rule-f75sud1b 已加 HOST=ocr.520why.top AND 条件
- **仍 522**：请求未命中函数、回落 origin（nas 不可达）→ 放弃，转向本教程 SCF 方案
- 如不再需要，可在 EdgeOne 控制台删除该加速域名与函数，避免产生困惑
