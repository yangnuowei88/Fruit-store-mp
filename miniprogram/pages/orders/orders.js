const app = getApp()
const md5 = require("../../utils/md5.js")

Page({
  data: {
    address: {},
    hasAddress: false,
    total: 0,
    orders: [],
    myList: [],
    openid: '',
    nonce_str: ''
  },

  onReady() {
    const self = this;
    // console.log(app.globalData.carts)
    
    // 32位随机字符串
    var nonce_str = app.RndNum()

    // 获取ip地址
    wx.cloud.callFunction({
      name: 'getIP'
    }).then(e=>{
      if(e && e.result && e.result.body){
        try {
          // 解析JSON响应获取IP地址
          let ipData = JSON.parse(e.result.body);
          let spbill_create_ip = ipData.query || '127.0.0.1'; // 使用query字段，失败时使用默认IP
          
          // 验证IP地址格式
          if (!this.isValidIP(spbill_create_ip)) {
            spbill_create_ip = '127.0.0.1'; // 使用默认IP
          }
          
          console.log("IP地址为：" + spbill_create_ip)
          self.setData({
            spbill_create_ip: spbill_create_ip
          })
        } catch (parseError) {
          console.error('IP解析失败:', parseError);
          // 使用默认IP地址
          self.setData({
            spbill_create_ip: '127.0.0.1'
          })
        }
      } else {
        // 获取IP失败，使用默认IP
        self.setData({
          spbill_create_ip: '127.0.0.1'
        })
      }
    }).catch(err=>{
      console.error('获取IP失败:', err);
      // 使用默认IP地址
      self.setData({
        spbill_create_ip: '127.0.0.1'
      })
    })

    // 获取总价和openid
    self.setData({
      orders: app.globalData.carts,
      nonce_str: nonce_str
    })
    this.getOpenid();
    this.getTotalPrice();
  },
  // onReady↑

  // IP地址格式验证
  isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  },

  onShow: function () {
    const self = this;
    wx.getStorage({
      key: 'address',
      success(res) {
        self.setData({
          address: res.data,
          hasAddress: true
        })
      }
    })
  },

  /**
   * 计算总价
   */
  getTotalPrice() {
    let orders = this.data.orders;
    let total = 0;
    for (let i = 0; i < orders.length; i++) {
      total += orders[i].num * orders[i].price;
    }
    // 确保最小金额为0.01元（1分钱）
    total = Math.max(0.01, total);
    this.setData({
      total: total.toFixed(2)
    })
  },
  

  // 获取用户openid
  getOpenid() {
    var that = this;
    wx.cloud.callFunction({
      name: 'add',
      complete: res => {
        console.log('云函数获取到的openid: ', res.result.openId)
        var openid = res.result.openId;
        that.setData({
          openid: openid,
        })
      }
    })
  },
  
  // -------------!! 支付！！------------------
  toPay() {
    var that = this
    if (that.data.hasAddress) {
      
      // 开发模式下使用模拟支付
      if (app.globalData.developmentMode) {
        that.mockPayment()
        return
      }

      // ------获取prepay_id，所需的签名字符串------
      var p = new Promise((resolve,reject)=>{
      // 生成支付订单号
      var out_trade_no = (new Date().getTime() + app.RndNum(6)).toString()
      
      // 生成业务订单号（包含日期时间）
      var orderNumber = that.generateOrderNumber()

      // -----生成字符串------
      var stringA = 
        "appid="+app.globalData.appid
      + "&attach=test"
      + "&body=JSAPItest"
      + "&device_info=WEB"
      + "&mch_id="+app.globalData.mch_id
      + "&nonce_str="+that.data.nonce_str
      + "&notify_url=http://www.weixin.qq.com/wxpay/pay.php"
      + "&openid="+that.data.openid
      + "&out_trade_no="+out_trade_no
      + "&spbill_create_ip="+that.data.spbill_create_ip
      + "&time_expire="+app.beforeNowtimeByMin(-15)
      + "&time_start="+app.CurrentTime()
      + "&total_fee="+Math.max(1, parseInt(that.data.total*100))
      + "&trade_type=JSAPI";

      var stringSignTemp = stringA +"&key="+app.globalData.apikey
      // 签名MD5加密
      var sign = md5.md5(stringSignTemp).toUpperCase()
      // console.log("签名：" + stringSignTemp)
      
      // openid
      var openid = that.data.openid

      resolve([sign,openid,out_trade_no])

      // ------生成订单信息-------
      let tmp = that.data.address
      tmp['schoolName'] = app.globalData.school_Arr[that.data.address['schoolName']]
      tmp['addressItem'] = app.globalData.address_Arr[that.data.address['addressItem']]
      tmp['orderTime'] = app.CurrentTime_show()
      tmp['orderSuccess'] = true
      tmp['payTime'] = ''
      tmp['paySuccess'] = false
      tmp['sending'] = false
      tmp['finished'] = false

      const order_master = tmp

      var tmpList = []
      that.data.orders.forEach((val,idx,obj)=>{
        tmpList.push([val.name, val.num, val.price])
      })
      order_master['fruitList'] = tmpList
      order_master['total'] = that.data.total
      order_master['openid'] = that.data.openid
      order_master['out_trade_no'] = out_trade_no
      order_master['orderNumber'] = orderNumber


      console.log(order_master)
      that.setData({
        address: order_master
      })

      // 上传数据库
      app.addRowToSet('order_master', order_master,e=>{
        console.log("订单状态已修改：【订单生成】"+e)
      })

      })
      p.then(e => {
        // 生成获取prepay_id请求的xml参数
        var xmlData = '<xml>'+
          '<appid>'+app.globalData.appid+'</appid>'+
          '<attach>test</attach>'+
          '<body>JSAPItest</body>'+
          '<device_info>WEB</device_info>'+
          '<mch_id>'+app.globalData.mch_id+'</mch_id>' +
          '<nonce_str>'+that.data.nonce_str+'</nonce_str>' +
          '<notify_url>http://www.weixin.qq.com/wxpay/pay.php</notify_url>' +
          '<openid>'+that.data.openid+'</openid>'+
          '<out_trade_no>'+e[2]+'</out_trade_no>'+
          '<spbill_create_ip>'+that.data.spbill_create_ip+'</spbill_create_ip>'+
          '<time_expire>'+app.beforeNowtimeByMin(-15)+'</time_expire>'+
          '<time_start>'+app.CurrentTime()+'</time_start>'+
          '<total_fee>'+Math.max(1, parseInt(that.data.total * 100))+'</total_fee>'+
          '<trade_type>JSAPI</trade_type>'+
          '<sign>'+e[0]+'</sign>'+
          '</xml>'

        var tmpOutNum = e[2]
        
        // 验证支付金额
        var totalFee = Math.max(1, parseInt(that.data.total * 100));
        console.log('支付金额验证:', {
          originalTotal: that.data.total,
          totalFee: totalFee,
          xmlData: xmlData
        });

        // 获取prepay_id,发送支付请求
        wx.cloud.callFunction({
          name:'pay',
          data:{
            xmlData:xmlData
          }
        })
        .then(res=>{
          console.log('支付云函数返回结果:', res)
          if(res){
            var prepay_id = res.result.body.split("<prepay_id><![CDATA[")[1].split("]]></prepay_id>")[0];
            var timeStamp = Math.round((Date.now() / 1000)).toString()
            var nonceStr = app.RndNum()
            var stringB =
              "appId=" + app.globalData.appid
              + "&nonceStr=" + nonceStr
              + "&package=" + 'prepay_id=' + prepay_id
              + "&signType=MD5"
              + "&timeStamp=" + timeStamp
            var paySignTemp = stringB + "&key=" + app.globalData.apikey
            // 签名MD5加密
            var paySign = md5.md5(paySignTemp).toUpperCase()
            // 调起请求
            wx.requestPayment({
              appId: app.globalData.appid,
              timeStamp: timeStamp,
              nonceStr: nonceStr,
              package: 'prepay_id=' + prepay_id,
              signType: 'MD5',
              paySign: paySign,
              success: function (e) {
                console.log(e)
                // console.log(tmpOutNum)
                app.getInfoWhere('order_master',{
                  'out_trade_no': tmpOutNum
                },e=>{
                  var orderId = e.data["0"]._id
                  app.updateInfo('order_master', orderId,{
                    'paySuccess':true,
                    'payTime': app.CurrentTime_show()
                  },e=>{
                    console.log("订单状态已修改：【支付成功】"+e)
                    wx.showToast({
                      title: '支付成功',
                    })
                    wx.switchTab({
                      url: '../me/me',
                    })
                  })
                })
              }
            })
          }
        })
        .catch(err=>{
          if(err){
            console.log(err)
            wx.showModal({
              title: '错误',
              content: '请重新点击支付~',
            })
          }
        })

      // end获取openid
      })

    // end if 地址  
    }

    else{
      wx.showModal({
        title: 'Oh No',
        content: '请填写收货地址~',
      })
    }
  },


  // 支付后的订单信息},

  // 模拟支付功能（仅用于开发测试）
  mockPayment() {
    var that = this
    
    // 生成模拟支付订单号
    var out_trade_no = (new Date().getTime() + app.RndNum(6)).toString()
    
    // 生成业务订单号（包含日期时间）
    var orderNumber = that.generateOrderNumber()
    
    // 生成订单信息
    let tmp = that.data.address
    tmp['schoolName'] = app.globalData.school_Arr[that.data.address['schoolName']]
    tmp['addressItem'] = app.globalData.address_Arr[that.data.address['addressItem']]
    tmp['orderTime'] = app.CurrentTime_show()
    tmp['orderSuccess'] = true
    tmp['payTime'] = app.CurrentTime_show()
    tmp['paySuccess'] = true  // 模拟支付成功
    tmp['sending'] = false
    tmp['finished'] = false
    tmp['orderStatus'] = '待发货'  // 设置订单状态

    const order_master = tmp

    var tmpList = []
    that.data.orders.forEach((val,idx,obj)=>{
      tmpList.push({
        name: val.name,
        num: val.num, 
        price: val.price,
        unit: val.unit,
        imgUrl: val.imgUrl
      })
    })
    order_master['orderItems'] = tmpList  // 使用orderItems字段名
    order_master['totalPrice'] = that.data.total  // 使用totalPrice字段名
    order_master['_openid'] = that.data.openid
    order_master['out_trade_no'] = out_trade_no
    order_master['orderNumber'] = orderNumber

    console.log('模拟支付订单:', order_master)

    // 上传到数据库
    app.addRowToSet('order_master', order_master, e => {
      console.log("模拟支付订单已生成：" + e)
      
      // 显示支付成功提示
      wx.showToast({
        title: '支付成功（模拟）',
        icon: 'success',
        duration: 2000
      })
      
      // 清空购物车
      app.globalData.carts = []
      
      // 跳转到个人中心
      setTimeout(() => {
        wx.switchTab({
          url: '../me/me',
        })
      }, 2000)
    })
  },

  // 生成订单号（格式：FS + YYYYMMDD + HHMMSS + 3位随机数）
  generateOrderNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    return `${year}${month}${day}${hour}${minute}${second}${random}`
  },

  getListAfterPay: function (that) {
    var p = new Promise((resolve, reject) => {
      let theList = []
      that.data.orders.forEach((val, idx, obj) => {
        var { name, num, price } = val
        var tmpInfo = { name, num, price }
        theList.push(tmpInfo)
      })
      resolve(theList)
    }).then(res => {
      // console.log(res)
      that.setData({
        myList: res
      })
    })
  },
})