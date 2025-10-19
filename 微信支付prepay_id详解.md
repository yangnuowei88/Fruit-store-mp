# 微信支付 prepay_id 详解

## 🤔 prepay_id 是什么？

**prepay_id**（预支付交易会话标识）是微信支付的核心概念，它是微信支付系统为每笔交易生成的唯一标识符。

---

## 🔄 微信支付完整流程

### 1. **统一下单** → 获取 prepay_id
```javascript
// 第一步：调用云函数向微信支付API发起统一下单请求
wx.cloud.callFunction({
  name: 'pay',
  data: {
    xmlData: xmlData  // 包含订单信息的XML数据
  }
})
```

### 2. **云函数处理** → 调用微信支付API
```javascript
// cloudfunctions/pay/index.js
const getPrepayIdPromise = function (event) {
  return new Promise((resolve, reject) => {
    let options = {
      "url": 'https://api.mch.weixin.qq.com/pay/unifiedorder',  // 微信统一下单接口
      "method": "POST",
      "headers": {
        "Content-Type": "text/xml",
        "charset": "utf-8"
      },
      "form": event.xmlData  // 发送订单XML数据
    };
    request.post(options, (err, result, body) => {
      resolve({
        err: err,
        body: body  // 返回包含prepay_id的XML响应
      })
    })
  })
}
```

### 3. **解析 prepay_id** → 从XML响应中提取
```javascript
// orders.js 第237行
var prepay_id = res.result.body.split("<prepay_id><![CDATA[")[1].split("]]></prepay_id>")[0];
```

### 4. **调起支付** → 使用 prepay_id
```javascript
// orders.js 第253行
wx.requestPayment({
  appId: app.globalData.appid,
  timeStamp: timeStamp,
  nonceStr: nonceStr,
  package: 'prepay_id=' + prepay_id,  // 关键：使用prepay_id
  signType: 'MD5',
  paySign: paySign,
  success: function (e) {
    // 支付成功处理
  }
})
```

---

## 📋 详细流程分析

### 第一步：构建统一下单请求
```javascript
// orders.js 第202-218行
var xmlData = '<xml>'+
  '<appid>'+app.globalData.appid+'</appid>'+           // 小程序ID
  '<attach>test</attach>'+                             // 附加数据
  '<body>JSAPItest</body>'+                           // 商品描述
  '<device_info>WEB</device_info>'+                   // 设备号
  '<mch_id>'+app.globalData.mch_id+'</mch_id>' +      // 商户号
  '<nonce_str>'+that.data.nonce_str+'</nonce_str>' +  // 随机字符串
  '<notify_url>http://www.weixin.qq.com/wxpay/pay.php</notify_url>' + // 通知地址
  '<openid>'+that.data.openid+'</openid>'+            // 用户openid
  '<out_trade_no>'+e[2]+'</out_trade_no>'+           // 商户订单号
  '<spbill_create_ip>'+that.data.spbill_create_ip+'</spbill_create_ip>'+ // 终端IP
  '<time_expire>'+app.beforeNowtimeByMin(-15)+'</time_expire>'+ // 交易结束时间
  '<time_start>'+app.CurrentTime()+'</time_start>'+   // 交易起始时间
  '<total_fee>'+Math.max(1, parseInt(that.data.total * 100))+'</total_fee>'+ // 总金额(分)
  '<trade_type>JSAPI</trade_type>'+                   // 交易类型
  '<sign>'+e[0]+'</sign>'+                           // 签名
  '</xml>'
```

### 第二步：云函数调用微信API
```javascript
// 云函数向微信支付服务器发送请求
POST https://api.mch.weixin.qq.com/pay/unifiedorder
Content-Type: text/xml

// 发送上面构建的xmlData
```

### 第三步：微信返回prepay_id
```xml
<!-- 微信支付API返回的XML响应 -->
<xml>
  <return_code><![CDATA[SUCCESS]]></return_code>
  <return_msg><![CDATA[OK]]></return_msg>
  <appid><![CDATA[wx2421b1c4370ec43b]]></appid>
  <mch_id><![CDATA[10000100]]></mch_id>
  <nonce_str><![CDATA[IITRi8Iabbblz1Jc]]></nonce_str>
  <sign><![CDATA[7921E432F65EB8ED0CE9755F0E86D72F]]></sign>
  <result_code><![CDATA[SUCCESS]]></result_code>
  <prepay_id><![CDATA[wx201411101639507cbf6ffd8b0779950874]]></prepay_id>  <!-- 这就是prepay_id -->
  <trade_type><![CDATA[JSAPI]]></trade_type>
</xml>
```

### 第四步：解析prepay_id
```javascript
// 从XML中提取prepay_id
var prepay_id = res.result.body.split("<prepay_id><![CDATA[")[1].split("]]></prepay_id>")[0];
// 结果：prepay_id = "wx201411101639507cbf6ffd8b0779950874"
```

### 第五步：生成支付签名
```javascript
// orders.js 第242-249行
var timeStamp = Math.round((Date.now() / 1000)).toString()
var nonceStr = app.RndNum()
var stringB =
  "appId=" + app.globalData.appid
  + "&nonceStr=" + nonceStr
  + "&package=" + 'prepay_id=' + prepay_id  // 使用prepay_id构建签名字符串
  + "&signType=MD5"
  + "&timeStamp=" + timeStamp
var paySignTemp = stringB + "&key=" + app.globalData.apikey
var paySign = md5.md5(paySignTemp).toUpperCase()  // MD5加密生成签名
```

### 第六步：调起微信支付
```javascript
// orders.js 第253-260行
wx.requestPayment({
  appId: app.globalData.appid,
  timeStamp: timeStamp,
  nonceStr: nonceStr,
  package: 'prepay_id=' + prepay_id,  // 关键参数：告诉微信要支付哪个预订单
  signType: 'MD5',
  paySign: paySign,
  success: function (e) {
    // 支付成功，更新订单状态
    app.updateInfo('order_master', orderId, {
      'paySuccess': true,
      'payTime': app.CurrentTime_show()
    })
  }
})
```

---

## 🎯 prepay_id 的核心作用

### 1. **预订单标识**
- prepay_id 代表一个**预支付订单**
- 微信支付系统已经为这笔交易做好准备
- 用户点击支付时，微信知道要处理哪笔订单

### 2. **安全验证**
- prepay_id 包含了订单的所有信息（金额、商品、用户等）
- 防止订单信息被篡改
- 确保支付的安全性

### 3. **状态管理**
- prepay_id 有有效期（通常2小时）
- 微信可以追踪订单状态
- 支持订单查询和退款

---

## 🔐 为什么需要云函数？

### 安全考虑
```javascript
// 这些敏感信息不能暴露在前端
var xmlData = '<xml>'+
  '<mch_id>'+app.globalData.mch_id+'</mch_id>' +      // 商户号（敏感）
  '<sign>'+e[0]+'</sign>'+                           // 签名（敏感）
  // ... 其他敏感信息
  '</xml>'
```

### API限制
- 微信统一下单接口只能在服务端调用
- 需要商户密钥进行签名
- 前端无法直接访问

---

## 📊 支付流程时序图

```
小程序前端          云函数           微信支付API        微信支付客户端
    │                │                  │                  │
    │──构建订单信息──→│                  │                  │
    │                │──统一下单请求──→│                  │
    │                │←──返回prepay_id──│                  │
    │←──返回prepay_id──│                  │                  │
    │                │                  │                  │
    │──生成支付签名──→│                  │                  │
    │                │                  │                  │
    │──调起支付────────────────────────→│                  │
    │                │                  │──调起支付界面──→│
    │                │                  │←──用户确认支付──│
    │←──支付结果────────────────────────│                  │
    │                │                  │                  │
    │──更新订单状态──→│                  │                  │
```

---

## 🚀 关键代码解析

### 1. **XML数据构建**
```javascript
// 为什么用XML？因为微信支付API要求XML格式
var xmlData = '<xml>'+
  '<total_fee>'+Math.max(1, parseInt(that.data.total * 100))+'</total_fee>'+ // 金额转换为分
  // ... 其他参数
  '</xml>'
```

### 2. **prepay_id提取**
```javascript
// 为什么这样解析？因为微信返回的是XML格式
var prepay_id = res.result.body.split("<prepay_id><![CDATA[")[1].split("]]></prepay_id>")[0];
// 从: <prepay_id><![CDATA[wx201411101639507cbf6ffd8b0779950874]]></prepay_id>
// 提取: wx201411101639507cbf6ffd8b0779950874
```

### 3. **支付调起**
```javascript
// 为什么需要这些参数？微信支付安全要求
wx.requestPayment({
  appId: app.globalData.appid,        // 应用ID
  timeStamp: timeStamp,               // 时间戳
  nonceStr: nonceStr,                 // 随机字符串
  package: 'prepay_id=' + prepay_id,  // 预支付ID（核心）
  signType: 'MD5',                    // 签名类型
  paySign: paySign,                   // 签名（防篡改）
})
```

---

## 📝 总结

### prepay_id 的本质
1. **预支付订单的唯一标识**
2. **连接商户系统和微信支付的桥梁**
3. **确保支付安全和订单完整性的关键**

### 整个流程的核心
1. **统一下单** → 告诉微信"我要收钱"
2. **获取prepay_id** → 微信说"好的，给你个订单号"
3. **调起支付** → 用户看到支付界面
4. **完成支付** → 钱到账，订单完成

这就是为什么需要云函数获取prepay_id的原因：**安全性和API限制**！🔐