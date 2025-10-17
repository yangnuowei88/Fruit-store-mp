// page/component/new-pages/user/user.js
const app = getApp();

Page({
  data: {
    orders: [],
    hasAddress: false,
    address: {},
    isAdmin: -1,
    openid: '',
    // 开发模式：设置为true时所有用户都有管理员权限
    developmentMode: true,
    adiminArr: [
      '',
      'onKwC5ZT_bj3UX10GrLGW3y-o4cY',
    ]
  },
  onLoad() {
    var that = this;
    that.getOpenidAndOrders();
    // console.log(that.data)
  },

  onShow() {
    var self = this;
    // console.log(self.data)
    /**
     * 获取本地缓存 地址信息
     */
    wx.getStorage({
      key: 'address',
      success: function (res) {
        self.setData({
          hasAddress: true,
          address: res.data
        })
      }
    })
  },
  onPullDownRefresh: function () {
    var that = this
    that.getOpenidAndOrders()
    var timer

    (timer = setTimeout(function () {
      wx.stopPullDownRefresh()
    }, 500));

  },

  // 获取用户openid
  getOpenidAndOrders() {
    var that = this;
    wx.cloud.callFunction({
      name: 'add',
      complete: res => {
        console.log('云函数获取到的openid: ', res.result.openId)
        var openid = res.result.openId;
        
        // 开发阶段：显示openid用于添加到管理员列表
        console.log('=== 开发调试信息 ===')
        console.log('当前用户openid:', openid)
        console.log('请将此openid添加到adiminArr数组中')
        console.log('==================')
        
        // 临时弹窗显示openid（开发阶段使用）
        wx.showModal({
          title: '开发调试',
          content: '你的openid是：' + openid + '\n\n请复制此openid到代码中的adiminArr数组',
          showCancel: false
        })
        
        var isAdmin = null;
        // 开发模式下所有用户都有管理员权限
        var adminIndex = that.data.developmentMode ? 0 : that.data.adiminArr.indexOf(openid);
        
        that.setData({
          openid: openid,
          isAdmin: adminIndex
        })
        app.getInfoWhere('order_master',{
          openid: openid
        },e=>{
          console.log('查询到的订单数据:', e.data)
          // 直接使用查询结果，按时间倒序排列（最新的在前面）
          var orders = e.data.reverse()
          that.setData({
            orders: orders
          })
        })
      }
    })
  },

  

  goToBgInfo: function() {
    wx.navigateTo({
      url: '/pages/bgInfo/bgInfo',
    })
  },

  goToBgManage: function () {
    wx.navigateTo({
      url: '/pages/bgManage/bgManage',
    })
  },

  goToRiderManage: function () {
    wx.navigateTo({
      url: '/pages/riderManage/riderManage',
    })
  }

})