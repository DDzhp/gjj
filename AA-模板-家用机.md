`更新时间: 2018-01-17 (liutao)`
### 1.开发配置数据
	公众号: AAAAAAAAAAAA 密码:BBBBBBBBBBBBBB
	微信支付: CCCCCCCCCCCCC 操作密码:EEEEEEEEEEEEEEE
	// ============= 需要保存的数据
	// 2. App ID 开发 - 开发配置 
	'WXAPP_ID' => 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',  
	// 3. App Secret  开发 - 开发配置 
	'WXAPP_SECRET' => 'FFFFFFFFFFFFFFFFFFF', 
	// === 微信支付
	// 4. 商户号 需要提供
	'WPAY_MCHID' => 'CCCCCCCCCCCCC', 
	// 5. API密钥(随意改动一些字符,必须32位) 需要设置
	'WPAY_KEY' => 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', 
	// 6. 'FACT_ID' 需要在超管添加厂家ID
	'FACT_ID' =>  '1001',
	// 8. 'IP' 原始ID
	'原始ID' => '原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID',
	// 10. 'IP' IP白名单设置
	'FACT_ID' =>  '
47.92.99.3
47.92.70.25
',

##### 1. 厂商管理 - 添加厂商
账号密码规则 (首字母+ID) 2018+ID 
##### 2.给客户添加个总代理, 如  (10470) = 100047 的默认总代理
https://mp.weixin.qq.com/
	1.APP_ID  开发 - 开发配置  
	2.APP_SECRET	开发 - 开发配置 启用或者重置需要管理员验证
	3.下载校验文件  公众号设置 - 功能设置 - 网页授权域名 - 3.将文件 xxxx(点击下载) 点击下载下来
	4.公众号设置 - 功能设置 
		
		网页授权域名   

cloud.yuelongxinxi.com		
		
		JS接口安全域名

cloud.yuelongxinxi.com		
		
		业务域名

cloud.yuelongxinxi.com
	
	5.设置菜单


卡码一体
我的卡包：http://cloud.yuelongxinxi.com/wx/1001?url=/wx/cup/cardbag
我的订单：http://cloud.yuelongxinxi.com/wx/1001?url=/wx/cup/order
个人中心：http://cloud.yuelongxinxi.com/mine/1001
售水机经销商：http://cloud.yuelongxinxi.com/agent/1001

家用机
运营商端：http://cloud.yuelongxinxi.com/dealer/1001
设备管理：http://cloud.yuelongxinxi.com/device/1001
我是师傅：http://cloud.yuelongxinxi.com/worker/1001
预约装机：http://cloud.yuelongxinxi.com/wyy/1001
预约工单：http://cloud.yuelongxinxi.com/yyorder/1001 

幼儿园
家长端：http://cloud.yuelongxinxi.com/kid/1001
园长端：http://cloud.yuelongxinxi.com/child-tutor/1001


中小学
运营商端：http://cloud.yuelongxinxi.com/school/1001
用户端：http://cloud.yuelongxinxi.com/parent/1001



https://pay.weixin.qq.com/
	1.设置API密钥  账户中心 - API安全 - 设置密钥
	2.添加支付授权目录  产品中心 - 开发配置 - 支付配置 - 添加
	
cloud.yuelongxinxi.com/wx/pay/
物联网净水器状态变更需要通知用户，请同意申请。

# 云平台资料 
### 管理后台
##### 经销商,厂商使用: [http://cloud.yuelongxinxi.com](http://cloud.yuelongxinxi.com)        
##### 厂商账号: `账号:1001 密码:654321`   

- <span style="color:green;font-size:20px">测试链接</span>: [http://cloud.yuelongxinxi.com/tool/1001](http://cloud.yuelongxinxi.com/tool/1001)

---
### 帮助手册

- [<span style="color:red;font-size:20px">_____________**家用机初始化教程-初始化教程（厂商）** -文档链接_____________</span>](http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=19&sign=c36549ef68f806439c3cd2317ef31811)
<span style="font-size:14px;text-decoration:underline"><http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=19&sign=c36549ef68f806439c3cd2317ef31811></span>

- [<span style="color:red;font-size:20px">_____________**家用机-经销商小程序教程** -文档链接_____________</span>](http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=96&sign=df88cf55288a69349e039f7824457a59)
<span style="font-size:14px;text-decoration:underline"><http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=96&sign=df88cf55288a69349e039f7824457a59></span>  
小程序二维码
<img src="http://docx.yuelongxinxi.com/upload/2025-08/79a660af5392e65bde0600561425bb2c83bc143defdfe3e3c3ed3f1ddca5d531.jpg" alt="智净水管家" title="智净水管家" width="20%">


- [<span style="color:red;font-size:20px">_____________**家用机平台介绍（厂商）** -文档链接_____________</span>](http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=27&sign=e0f3d52e91740b4ed269e17f8ff4dbaa)
<span style="font-size:14px;text-decoration:underline"><http://docx.yuelongxinxi.com/static/views/doc_content/index.html?doc_content_id=27&sign=e0f3d52e91740b4ed269e17f8ff4dbaa></span>

### 重要告警
- <span style="color:red;font-size:20px">⚠️ 严禁私自更换物联网卡！会导致锁卡不联网！！！</span>  
- <span style="color:red;font-size:20px">⚠️ 后台套餐价格不可设为0，最低0.01元！</span>
- <span style="color:red;font-size:20px">⚠️微信公众号菜单“预约装机” 打开后显示空白的，需要自行在后台添加预约装机套餐！！！</span>
---

### 菜单配置

- ​**设备管理**:
	[http://cloud.yuelongxinxi.com/device/1001](http://cloud.yuelongxinxi.com/device/1001)
- ​**我是师傅**:
	[http://cloud.yuelongxinxi.com/worker/1001](http://cloud.yuelongxinxi.com/worker/1001)
- ​**预约装机**:
	[http://cloud.yuelongxinxi.com/wyy/1001](http://cloud.yuelongxinxi.com/wyy/1001)
- ​**预约工单**:
	[http://cloud.yuelongxinxi.com/yyorder/1001](http://cloud.yuelongxinxi.com/yyorder/1001) 

## 公众号信息
### 基础信息

```yaml

公司全称: 公司全称-暂无  
公众号名称: 公众号名称-暂无  
客服电话: 客服电话-暂无  
客服手机: 客服手机-暂无  
```

### 账号密钥
```yaml
# 公众号凭证
公众号账号: 公众号账号-暂无
公众号密码: 公众号密码-暂无
公众号APPID: 公众号APPID-暂无
公众号开发者密码 App Secret: 公众号开发者密码 App Secret-暂无

# 支付配置
商户号: 商户号-暂无
商户号操作密码: 商户号操作密码-暂无
商户号支付密钥WPAY_KEY: 商户号支付密钥WPAY_KEY-暂无

```

---

## 注意事项
1. 标红内容为**高危操作提示**，请严格遵守。
2. 若公众号使用第三方平台（如微盟），需自行配置菜单链接。
---

47.92.99.3
47.92.70.25



  
原始ID => '原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID原始ID',


