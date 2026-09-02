# 云 OCR 与云二维码识别接入方案（工具集网页版）

> 适用面板：📱 二维码批量识别
> 目的：解决 PCB 电路板图 IMEI 竖排（旋转 90°）导致 Tesseract 本地 OCR 识别率低的问题；同时提供二维码识别的云端备选。
> 设计原则：**本地引擎（Tesseract / jsQR+ZXing）保留为备选**，网页版可选「本地 / 云接口」双引擎；云接口密钥只在代理侧（云端 Worker 或本机），浏览器不直接接触密钥。
>
> **推荐路线（免本地代理）**：Cloudflare Workers 云端代理（详见《Cloudflare Workers 部署指南.md》），部署一次永久使用；
> 本地代理 `cloud_ocr_proxy.py` 保留为备选。两种代理端点完全兼容，网页版「云端代理地址」填谁用谁。

---

## 一、总体架构

### 方案 A（推荐）：Cloudflare Workers 云端代理 — 免本地代理

```
┌─────────────┐  fetch https://xxx.workers.dev  ┌──────────────────┐   HTTPS   ┌─────────┐
│  浏览器网页版 │ ──────────────────────────────▶ │ cloud_ocr_worker │ ────────▶ │ 百度/腾讯│
│ (GitHub Pages)│                                │  (Workers 免费)   │            │  云 API  │
│  选「云」引擎 │ ◀────────────────────────────── │  密钥=环境变量    │ ◀────────  └─────────┘
└─────────────┘          JSON 返回               └──────────────────┘
```

- 密钥放在 Worker **环境变量**（Settings → Variables），不进入网页代码、不公开
- 部署一次永久使用；免费 10 万请求/天，远超日常用量
- 部署步骤见《Cloudflare Workers 部署指南.md》（注册 → 创建 Worker → 粘贴 `cloud_ocr_worker.mjs` → 填 4 个环境变量 → 部署）

### 方案 B（备选）：本地代理

```
┌─────────────┐   fetch http://localhost:8765   ┌──────────────────┐
│  浏览器网页版 │ ──────────────────────────────▶ │ cloud_ocr_proxy.py│
│ (GitHub Pages)│                                │   本地代理(0依赖)  │
│  选「云」引擎 │ ◀────────────────────────────── │  ┌────────────┐ │
└─────────────┘          JSON 返回               │  │ /ocr → 百度  │ │
                                                │  │ /qr  → 腾讯  │ │
                                                │  └────────────┘ │
                                                └──────────────────┘
```

- **为什么不能浏览器直连云 API**：实测百度 token/OCR 接口与腾讯云 API 均**不带 CORS 响应头**，浏览器跨域请求会被拦截——必须有服务端中转
- 本地代理用 Python 标准库（`http.server` + `urllib`）实现，**零第三方依赖**，密钥放在代理同目录 `config.json`（或环境变量），只在本机生效
- Chrome / Edge 对 HTTPS 页面（GitHub Pages）请求 `http://localhost` 有白名单豁免（需代理响应 `Access-Control-Allow-Private-Network: true`，已实现）

---

## 二、百度智能云 OCR（通用文字识别）

### 1. 免费额度
| 项目 | 额度 |
|---|---|
| 通用文字识别标准版（general_basic） | **50000 次/天 免费**（个人实名即可） |
| 高精度版（accurate_basic） | 500 次/天 免费 |
| 核心优势 | 支持 `detect_direction=true` **自动检测并纠正图片方向**，正好解决 PCB 竖排 IMEI 旋转 90° 的问题 |

### 2. 申请流程（约 10 分钟）

**第 1 步：注册并实名认证**
1. 打开 <https://login.bce.baidu.com/> 用百度账号登录（没有先注册）。
2. 进入 <https://console.bce.baidu.com/> 百度智能云控制台。
3. 右上角「实名认证」→ 个人认证：选「个人」，填姓名+身份证号，用百度 App 扫脸即可，**通常几分钟内通过**（免费额度不需要企业认证）。

**第 2 步：开通「文字识别」服务**
1. 控制台搜索或进入 <https://console.bce.baidu.com/ai/#/ai/ocr/overview/index>「文字识别」。
2. 找到「通用文字识别（标准版）」→ 点击「**立即开通**」（免费，不扣费）。
3. 若提示选择资源包/套餐，选「免费测试资源」或直接开通即可，个人免费额度按天自动刷新。

**第 3 步：创建应用，获取 API Key / Secret Key**
1. 进入 <https://console.bce.baidu.com/ai/#/ai/ocr/app/list>「应用列表」→「**创建应用**」。
2. 应用名称随便填（如「工具集OCR」），类型选「文字识别」，接口勾选「通用文字识别」。
3. 创建成功后点「**查看密钥**」，记录：
   - **API Key**（对应 `BAIDU_API_KEY`）
   - **Secret Key**（对应 `BAIDU_SECRET_KEY`）

### 3. 接口调用原理（代理已封装，了解即可）
```
① 获取 token：
   POST https://aip.baidubce.com/oauth/2.0/token
        ?grant_type=client_credentials&client_id=API_KEY&client_secret=SECRET_KEY
   → 返回 { access_token }（有效期 30 天，代理会缓存）

② 识别：
   POST https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=xxx
   Content-Type: application/x-www-form-urlencoded
   body: image=<图片base64>&detect_direction=true
   → 返回 { words_result: [ { words: "..." } ] }
```

### 4. 数字识别（v1/numbers）—— 新增选项，适合 IMEI 纯数字场景

> 网页版 OCR 引擎下拉新增【百度云数字识别】，走代理 `/ocr_numbers` 端点；**原有引擎全部保留**，仅新增。

| 项目 | 说明 |
|---|---|
| 接口 | `https://aip.baidubce.com/rest/2.0/ocr/v1/numbers`（与通用版同 token） |
| 免费额度 | **200 次/天**（2023-05-30 上线计费后调整；通用版为 50000 次/天，注意额度差异） |
| 特点 | 只返回数字内容，**自动过滤字母/符号/中文**，数字识别准确率 >99%；支持 `detect_direction=true` 自动纠偏（竖排 IMEI 友好） |
| 适用 | PCB 电路板贴纸上的 IMEI/设备号等**纯数字**小批量高精度识别 |
| 不适用 | 含字母/中文混合内容（如 SN 批次号、型号）——会被过滤，此时请用通用版 |

调用示例（代理已封装，网页版无需关心）：
```
POST https://aip.baidubce.com/rest/2.0/ocr/v1/numbers?access_token=xxx
body: image=<图片base64>&detect_direction=true
→ 返回 { words_result: [ { "words": "8609290991342015" }, ... ] }
```

---

## 三、腾讯云 QrcodeOCR（二维码/条形码识别）

### 1. 免费额度
| 项目 | 额度 |
|---|---|
| 智能扫码（QrcodeOCR） | **1000 次/月 免费**（每月 1 号自动发放当月额度） |
| 计费说明 | 与腾讯云 OCR 共享免费资源包；超出后按量计费（可关闭自动付费） |
| 能力 | 识别二维码、条形码，返回内容+位置坐标（Quadrangle 四角点） |

### 2. 申请流程（约 15 分钟）

**第 1 步：注册并实名认证**
1. 打开 <https://cloud.tencent.com/> 用微信/QQ 登录（没有先注册）。
2. 进入 <https://console.cloud.tencent.com/> 控制台 → 完成「**实名认证**」（个人：微信扫脸即过）。

**第 2 步：创建 API 密钥（SecretId / SecretKey）**
1. 进入 <https://console.cloud.tencent.com/cam/capi>「访问管理 → API 密钥管理」。
2. 点击「**新建密钥**」→ 用手机验证后生成一对：
   - **SecretId**（对应 `TENCENT_SECRET_ID`）
   - **SecretKey**（对应 `TENCENT_SECRET_KEY`）
3. ⚠️ 注意：SecretKey 只在创建时显示一次，务必立即复制保存。

**第 3 步：开通「OCR - 智能扫码」服务**
1. 进入 <https://console.cloud.tencent.com/ocr>「文字识别 OCR 控制台」。
2. 找到「**智能扫码 QrcodeOCR**」→「**开通服务**」（免费开通）。
3. 免费额度在 <https://console.cloud.tencent.com/ocr/scan> 查看当月剩余次数。
4. （可选）为避免误扣费，在「费用中心 → 账户设置」关闭「自动续费/后付费」开关。

### 3. 接口调用原理（TC3-HMAC-SHA256 签名，代理已封装）
```
POST https://ocr.tencentcloudapi.com/
Headers:
  Content-Type: application/json; charset=utf-8
  X-TC-Action: QrcodeOCR
  X-TC-Version: 2018-11-19
  X-TC-Timestamp: <当前秒级时间戳>
  X-TC-Region: ap-guangzhou
  Authorization: TC3-HMAC-SHA256 Credential=SecretId/2026-09-01/ocr/tc3_request, SignedHeaders=content-type;host, Signature=<hex>

Body: { "ImageBase64": "<图片base64，不带 data: 前缀>" }

响应: { Response: { TaskStatus: "SUCCESS", CodeResults: [ { Type: "QRCode", Data: "https://...", Quadrangle: [...] } ] } }
```
签名流程（TC3）：规范请求串 → 签名串 → 派生密钥（HMAC-SHA256 三级派生）→ 最终签名。代理中已完整实现，无需手工处理。

---

## 四、本地代理部署与使用

### 1. 文件清单
| 文件 | 说明 |
|---|---|
| `cloud_ocr_proxy.py` | 本地代理主程序（Python 3 标准库，零依赖） |
| `config.json`（可选） | 存放 4 个密钥（与代理同目录）；**不要上传到 GitHub**（.gitignore 已排除） |

### 2. 配置密钥
在代理同目录新建 `config.json`（也可用环境变量替代，见下）：
```json
{
  "baidu_api_key": "你的百度API Key",
  "baidu_secret_key": "你的百度Secret Key",
  "tencent_secret_id": "你的腾讯SecretId",
  "tencent_secret_key": "你的腾讯SecretKey"
}
```
> 环境变量方式（不写文件）：`BAIDU_API_KEY` / `BAIDU_SECRET_KEY` / `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`，优先级：环境变量 > config.json。

### 3. 启动代理
```bash
# 命令行（任选其一）
python cloud_ocr_proxy.py

# 或后台启动（Windows）
start /b python cloud_ocr_proxy.py
```
启动成功显示：`Cloud OCR Proxy running on http://localhost:8765`。保持窗口开着即可。

### 4. 网页版切换引擎
| 下拉选项 | 行为 |
|---|---|
| OCR 引擎 = 本地 | 现有 Tesseract（离线可用） |
| OCR 引擎 = 百度云 | 走本地代理 `/ocr`，自动纠偏旋转，**对竖排 IMEI 识别率大幅提升** |
| 二维码引擎 = 本地 | 现有 jsQR 网格分块 + ZXing（离线可用） |
| 二维码引擎 = 腾讯云 | 走本地代理 `/qr`，云端兜底 |

- 页面底部会实时显示「代理状态：✅ 已连接 / ❌ 未连接」。
- 开始识别前若选了「云」引擎且代理未启动，会提示先启动代理。
- 图片在浏览器端先缩放到最长边 2400px（JPEG 0.9）再上传，控制流量与接口大小限制。

### 5. 接口一览（供调试）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/ping` | 健康检查，返回 `{ok:true, engine:"cloud"}` |
| POST | `/ocr` | multipart 图片 → 百度通用文字识别 → `{text:"..."}` |
| POST | `/ocr_numbers` | multipart 图片 → 百度数字识别 v1/numbers（仅返回数字）→ `{text:"..."}` |
| POST | `/qr` | multipart 图片 → 腾讯 QrcodeOCR → `{codes:[{data,x,y,w,h}]}` |

---

## 五、常见问题（FAQ）

**Q1：为什么不直接在网页里调云接口？**
云接口跨域受限且需要密钥签名；密钥放网页 = 泄露。本地代理是唯一既安全（密钥不出本机）又省事（零依赖）的方案。

**Q2：百度 OCR 为什么识别竖排 IMEI 效果好？**
`detect_direction=true` 会先检测图像朝向并自动旋转纠偏，再按水平方向识别。Tesseract 本地版没有可靠的朝向检测，对旋转 90° 的文字基本无能为力——这正是此前 img1-4 全失败的原因。

**Q3：腾讯云 QrcodeOCR 免费额度每月 1 号清零吗？**
是的，每月 1 号自动发放 1000 次当月有效，用不完不结转。可在腾讯云 OCR 控制台查看剩余次数。

**Q4：代理会占端口冲突吗？**
默认 8765，可用 `--port` 指定其他端口：`python cloud_ocr_proxy.py --port 9000`。

**Q5：图片太大接口报错怎么办？**
浏览器端已自动缩放至 2400px；百度要求 base64 后 ≤10MB（约 7.5MB 原图），腾讯要求 base64 后 ≤7MB。极端大图建议先手动压缩。

**Q6：密钥丢了怎么办？**
百度：应用列表 → 查看密钥（可重置 Secret Key）；腾讯：CAM 密钥管理 → 新建密钥（旧密钥可禁用）。

---

## 六、费用与安全提醒

- 百度 50000 次/天 + 腾讯 1000 次/月，**个人日常使用完全免费**，不会产生扣费。
- 建议腾讯云控制台关闭「后付费自动扣费」开关，避免超额意外扣费。
- `config.json` 已加入 `.gitignore`，推送 GitHub 前确认不包含密钥。
- 代理仅监听 `127.0.0.1`，不对外网开放；用完可直接关掉窗口。
