# 腾讯云 EdgeOne 边缘函数 云端代理部署指南（免本地代理 · 国内访问稳定）

> 目标：把云 OCR / 云二维码的转发逻辑部署到 **腾讯云 EdgeOne 免费版**的边缘函数上，
> **网页版直接调用云端地址，不用再启动本地代理**。密钥放在 EdgeOne 环境变量（不公开）。
> 解决 Cloudflare Workers 国内访问不稳定的问题（这是 Cloudflare 版在国内的替代方案）。
> 部署一次，永久使用；网页版只需填写一次代理地址（浏览器本地保存）。

---

## 为什么选 EdgeOne 免费版

| 项 | Cloudflare Workers | 腾讯云 EdgeOne（免费版） |
|---|---|---|
| 国内访问 | 经常超时 / 加载慢 | 走腾讯云国内节点，秒级响应 |
| 免费请求额度 | 10 万/天 | **300 万次/月**（≈ 10 万/天） |
| 免费 CPU 时间 | 10ms/请求 | 300 万 ms/月 |
| 代码包大小 | 1 MB（免费版） | **5 MB** |
| 请求 body 大小 | 100 MB | **1 MB**（够 OCR 用） |
| 超量策略 | 立即报错 | **直接规则失效**（不像付费版有后付费） |
| 配置难度 | 极简 | 略复杂（要先有 EdgeOne 站点） |

> 本工具集每天最多几十次调用 → EdgeOne 免费版配额**完全用不完**，月成本 0 元。
> 若担心免费版超限失效，可订阅国际站「免费套餐增值套件」（15 USD/月）解锁按量付费。

---

## 1. 注册 / 登录腾讯云 + 开通 EdgeOne

1. 打开 https://cloud.tencent.com 注册并实名认证（必须，国内云统一要求）
2. 控制台搜索「**边缘安全加速平台**」或「**EdgeOne**」→ 进入产品页 → 点「**立即选购**」
3. 选「**免费版**」套餐下单（0 元）→ 开通后会自动跳到控制台

> 你截图里已经有 520why.top (66) / 520why.top / 520why.top (nas) 三个站点，说明已开通过，直接进入站点即可。

---

## 2. 进入「函数管理」

1. 左侧菜单「**站点列表**」→ 点击你的站点（如 `520why.top (66)`）
2. 站点详情页左侧菜单找到「**高级能力 → 边缘函数**」（你的截图里能看到）
3. 点「**函数管理**」→ 进入函数列表页（当前是空的，正常）

---

## 3. 创建并部署边缘函数

1. 在「函数管理」页点「**新建函数**」
2. 选「**空白创建**」（或「使用模板创建」都行，空白更干净）
3. 配置参数：
   - **函数名**：`ocr-proxy`（字母开头，2-30 字符，**创建后不可改**）
   - **描述**：`云 OCR/二维码代理（百度+腾讯）`
   - **代码**：把仓库里 `cloud_ocr_edgeone.mjs` 的**全部内容**粘贴进去
4. 点「**创建并部署**」→ 弹出「部署成功」对话框
5. 此时可点「**平台分配的默认访问域名**」验证——但注意：**大陆 IP 用默认域名会被强制下载文件**（见第 6 节说明），请用 curl 验证或直接配好触发规则后走 520why.top

> 💡 代码入口是 EdgeOne 边缘函数规范的 **`addEventListener('fetch', ...)`**，
> ⚠️ **不是** Cloudflare Workers 的 `export default { async fetch(...) }`，也**不是** EdgeOne Pages 的 `export function onRequest`，
> 三者不能互换（详见下方"常见错误 545"——入口写错会 545，连 Hello World 都救不回来）。

## ⚠️ 常见错误 545（边缘函数执行异常）——必读

访问 `/ping` 返回 **HTTP 545** + body 为 `Error return from script`（24 字节），Console 几乎没日志。EdgeOne 不暴露具体堆栈，只能从响应特征反推根因。**唯一根因：代码入口写法错误**。

### 根因：入口没用 `addEventListener('fetch', ...)`

EdgeOne **边缘函数（函数管理）** 的入口规范与 Cloudflare Workers、EdgeOne Pages **都不同**：

| 平台 | 入口写法 |
|---|---|
| EdgeOne **边缘函数**（本教程） | ✅ `addEventListener('fetch', event => event.respondWith(handle(event.request)))` |
| Cloudflare Workers | ❌ `export default { async fetch(request, env) {...} }` |
| EdgeOne Pages Functions | ❌ `export function onRequest(context) {...}` |

`export default` / `onRequest` 的代码粘贴到边缘函数里，引擎**加载成功但注册不到任何 fetch 监听器**，
于是任何请求进来都判定「边缘函数执行异常」→ **545 `Error return from script`**。
这就是为什么连 Hello World 都会 545、且 Console 无日志——**代码根本没被执行**，与逻辑无关。

正确的最小 Hello World：

```js
addEventListener('fetch', event => {
  event.respondWith(new Response('ok', { headers: { 'Content-Type': 'text/plain' } }));
});
```

正确入口 + 异步业务（`cloud_ocr_edgeone.mjs` 即此结构）：

```js
addEventListener('fetch', function (event) {
  const env = (typeof env !== 'undefined' && env) ? env : {};   // 环境变量：全局 env
  event.respondWith(handleFetch(event.request, env));            // respondWith 支持 Promise
});

function handleFetch(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET' && path === '/ping') return json({ ok: true, engine: 'edgeone' });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  return handlePost(request, path, env);   // Promise 链，勿在入口 async/await
}
```

> 内部业务 async 函数（baiduOcr/tencentOcr 等）**原样保留**——它们返回 Promise，
> `event.respondWith()` 官方支持传入 Promise，无需改成同步。
> 可选 `event.passThroughOnException()`：函数抛异常时转发回源站而非报 545（本代理不需要，已用 .catch 统一转 502）。

### 处理办法

回「函数管理」页 → 把仓库里最新版 `cloud_ocr_edgeone.mjs`（已改为 **`addEventListener('fetch')` 入口**）**全部内容重新粘贴** → 点「**保存并部署**」（EdgeOne 不会自动保存，每次改完代码都必须点）→ 用 **curl** 重测（见下节，别用浏览器——默认域名对大陆 IP 会强制下载）。

---

## 4. 配置密钥环境变量（关键）

回到「函数管理」页，**滚动到「环境变量与密钥」区域**：

1. 点「**新增**」→ 类型选「**环境变量**」（或「**密钥**」，更安全，推荐）
2. 依次添加 4 个变量：

| 变量名 | 值（示例来源） |
|---|---|
| `BAIDU_API_KEY` | 百度智能云控制台 → 文字识别 OCR → 应用列表 → API Key |
| `BAIDU_SECRET_KEY` | 同上 → Secret Key（32 位十六进制） |
| `TENCENT_SECRET_ID` | 腾讯云控制台 → 访问管理 CAM → API 密钥管理 → SecretId |
| `TENCENT_SECRET_KEY` | 同上 → SecretKey |

3. 填完每个都点「**保存**」

> 环境变量保存后**不需要重新部署**，下次函数执行时即生效。
> 但如果函数代码本身改了，需要回「函数信息」页 → 改完代码 → 点「**保存并部署**」或 Ctrl+S。

> ⚠️ 如果百度密钥无效（之前实测 `invalid_client`），请先到百度控制台重新复制密钥再填。
> 填好前网页版可先只用「腾讯云」引擎（OCR + 二维码实测均可用）。

---

## 5. 配置触发规则（最关键一步）

回到「**站点管理 → 高级能力 → 边缘函数 → 触发配置**」页（不是「函数管理」页函数详情里的触发规则列表——那个只是只读视图，改规则要去「触发配置」页）：

1. 点「**新增触发规则**」
2. 配置匹配条件（推荐配 **2 条就够**）：

**规则 1（OCR 端点）**：

| 字段 | 值 | 说明 |
|---|---|---|
| 匹配类型 | **URL Path** | 按路径匹配 |
| 运算符 | **等于** | 提示框原文「`/example/*` 或 `/example/foo.jpg`（**回车分隔多个值**），多个值中匹配其一则为命中」：`*` **是通配符**（前缀匹配），多个值用**回车换行**分隔，不是逗号 |
| 值 | `/ocr*` | 通配符前缀匹配 → 命中 `/ocr` `/ocr_numbers` `/ocr_tencent` 及任意后缀 |

**规则 2（二维码端点）**：

| 字段 | 值 | 说明 |
|---|---|---|
| 匹配类型 | URL Path | |
| 运算符 | **等于** | |
| 值 | `/qr*` | 命中 `/qr` `/qr_baidu` 及任意后缀 |

3. 两条规则都点「**确定**」/「**保存**」→ 触发规则列表里出现后即生效

> 运算符备选方案：
> - 想一条规则覆盖全部端点：值可**回车分隔多值**，如 `/ocr*` 换行 `/qr*` 换行 `/ping*`（一则为命中即可）
> - 需要真正正则时选「正则匹配」（RE2），值如 `^/(ocr|qr).*$`
>
> EdgeOne URL Path 运算符仅 4 种：等于、不等于、正则匹配、正则不匹配。**「等于」配合通配符 `*` 即可实现前缀匹配**；多个路径值用**回车换行**分隔。
>
> ⚠️ **触发规则必须显式加 HOST 条件指定加速域名！** 仅有 URL Path 条件的规则**只对函数默认域名**（`*.eo-edgefunctions.com`）生效，对自定义加速域名（如 `ocr.520why.top`）**不生效**——这是 EdgeOne 反直觉的默认行为。配置示例：
>
> ```
> 条件1（HOST）：HOST 等于 ocr.520why.top
> 条件2（URL path）：URL path 等于 /ocr*     ← 用 + And 组合
> 动作：执行指定函数 → ocr-proxy-zone-xxxx
> ```
>
> 若规则配置正确但请求仍回源（HTTP 522 / 404 而非函数响应），排查顺序：① 确认规则在「触发配置」页而不是函数详情只读列表 ② 确认规则「执行函数」选中了目标函数 ③ 规则**必须加 HOST 条件**匹配自定义加速域名 ④ 确认函数本体已「部署」成功（函数管理页看状态） ⑤ 站点级「规则引擎」**不能触发函数**，确认没把规则加错地方。
## 6. 验证函数是否生效

打开浏览器（或 curl）访问：

```
https://520why.top/ping
```

应返回：

```json
{"ok":true,"engine":"edgeone","eo_region":"...","client_ip":"...","time":"..."}
```

- `engine: "edgeone"` → 说明 EdgeOne 函数已被命中
- 若返回 404 → 检查触发规则是否配对，路径前缀是否正确
- 若返回 502 + 密钥错误 → 环境变量未填或拼写错

继续验证 `/ocr`：

```bash
curl -X POST https://520why.top/ocr \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test.jpg
```

应返回 `{"text":"..."}` —— 有文字识别结果就 OK 了。

---

## 7. 网页版配置（一次性）

1. 打开线上工具集网页（https://gjj.cloud.yuelongxinxi.com 或本地 `index.html`）
2. 进入「二维码批量识别」工具
3. 在 **云端代理地址** 输入框填入 EdgeOne 地址（`https://520why.top`，**不要带尾部斜杠**）
4. 点 **保存**，再点 **测试连接** → 应提示「代理连接成功 ✅」
5. 二维码引擎 / OCR 引擎下拉选「腾讯云」或「百度云」→ 选图开始识别

> 地址保存在浏览器 localStorage，**只需配置一次**，以后打开网页直接可用。
> 想切回 Cloudflare Workers 或本地代理？直接改这个地址即可，三端端点完全兼容。

---

## 端点说明（与 cloud_ocr_worker.mjs / cloud_ocr_proxy.py 完全一致）

| 端点 | 云端服务 | 说明 |
|---|---|---|
| `GET /ping` | - | 健康检查，返回 `engine: "edgeone"` |
| `POST /ocr` | 百度 general_basic | OCR，自动纠偏旋转（竖排 IMEI 友好） |
| `POST /ocr_numbers` | 百度 v1/numbers | 数字识别（仅返回数字，99%+ 准确率，免费 200 次/天） |
| `POST /ocr_tencent` | 腾讯 GeneralBasicOCR | OCR（1000 次/月免费） |
| `POST /qr` | 腾讯 QrcodeOCR | 二维码识别（1000 次/月免费） |
| `POST /qr_baidu` | 百度 qrcode | 二维码识别（500 次/月免费） |

---

## 免费额度

- **EdgeOne 免费版**：300 万请求/月 + 300 万 CPU ms/月（≈ 10 万次/天），远超本工具集需求
- **腾讯云**：OCR + 二维码各 1000 次/月（每月 1 号重置）
- **百度**：OCR 5 万次/天；二维码 500 次/月；数字识别 200 次/天
- 用量大时本地引擎（jsQR / ZXing / Tesseract）完全免费不限额

---

## 多代理共存（Cloudflare / EdgeOne / 本地）

`cloud_ocr_proxy.py`、`cloud_ocr_worker.mjs`、`cloud_ocr_edgeone.mjs` 三个端点**完全一致**，
网页版「云端代理地址」可随时切换：

- `http://localhost:8765` —— 本地 Python 代理（启动 `python cloud_ocr_proxy.py`）
- `https://ocr-proxy.xxx.workers.dev` —— Cloudflare Workers（国外访问快，国内不稳定）
- `https://520why.top` —— EdgeOne 边缘函数（国内访问稳定，推荐**日常使用**）

三种代理互不影响，哪个能用用哪个。

---

## 安全说明

- 密钥只在 EdgeOne 环境变量中，**不进入网页代码、不公开**；浏览器只与边缘函数通信
- 任何打开网页的人都**无法**看到或盗用你的密钥（比「前端加密」安全得多）
- 若担心他人滥用，可在 EdgeOne 触发规则里限定 `主机` / `Header` / `Cookie` 做白名单（进阶，按需）

---

## 故障排查

| 现象 | 处理 |
|---|---|
| `/ping` 返回 404 | 检查触发规则路径前缀；确认函数已部署成功 |
| `/ping` 返回 **545**（body 24 字节 `Error return from script`） | **入口写法错误**：EdgeOne 边缘函数入口必须 `addEventListener('fetch', ...)`；`export default`/`onRequest` 是 Cloudflare Workers / EdgeOne Pages 的写法，引擎不识别 → 任何请求都 545（连 Hello World 也一样）。重新粘贴新版 `cloud_ocr_edgeone.mjs` → 「保存并部署」→ curl 重测 |
| 浏览器访问默认域名变成「下载文件」 | EdgeOne 对大陆 IP 的默认域名访问强制加 `Content-Disposition: attachment`（2025-09-08 起）——用 curl 验证，或把 520why.top 加为加速域名后走 `https://520why.top/...` |
| `/ping` 返回 `engine: "cloud-worker"` | 配错代理了，清掉 localStorage 里旧的 Worker 地址，改回 `https://520why.top` |
| 触发规则下拉没有「前缀匹配」 | EdgeOne URL Path 仅支持 4 种运算符（等于/不等于/正则匹配/正则不匹配）；用「等于」+ 通配符 `/ocr*` 等价于前缀匹配 |
| 百度引擎报 `Client authentication failed` | 百度密钥无效，去百度控制台重新复制，注意 32 位十六进制 |
| 识别报「腾讯密钥未配置」 | EdgeOne 环境变量未填或拼写错 |
| 识别慢（10s+） | 腾讯 OCR 处理大图需数秒，正常；前端会自动压缩到 2400px 再上传 |
| EdgeOne 超额提示 | 免费版限额 300 万/月，本工具集不会到；若到了会触发规则失效，考虑订阅增值套件 |
| 请求 body 超过 1 MB | 免费版限制，超大图先在前端压缩或改用付费版 |