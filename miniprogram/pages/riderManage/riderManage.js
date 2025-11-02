// pages/riderManage/riderManage.js
const app = getApp()

Page({
  data: {
    orderList: [],
    displayOrderList: [],
    pendingDeliveryCount: 0,  // 待配送订单数量
    totalOrderCount: 0        // 总订单数量
  },

  onLoad: function (options) {
    this.getAllList()
  },

  onShow: function () {
    this.getAllList()
  },

  onPullDownRefresh: function () {
    this.getAllList()
  },

  // 获取所有订单数据（复用bgManage的逻辑）
  getAllList: function() {
    var that = this
    app.getInfoByOrder('order_master', 'orderTime', 'desc', res => {
      console.log('获取订单数据:', res.data)
      
      // 计算待配送订单数量（已发货但未完成的订单）
      const pendingDeliveryOrders = res.data.filter(order => {
        return order.sending === true && order.finished !== true;
      });
      
      // 计算总订单数量
      const totalOrders = res.data.length;
      
      console.log('待配送订单数量:', pendingDeliveryOrders.length)
      console.log('总订单数量:', totalOrders)
      
      that.setData({
        orderList: res.data,
        displayOrderList: res.data,
        pendingDeliveryCount: pendingDeliveryOrders.length,
        totalOrderCount: totalOrders
      })
      wx.stopPullDownRefresh()
    })
  },

  // 确认送达（复用bgManage的sendingFruit逻辑）
  sendingFruit: function(e) {
    var that = this
    console.log(e.currentTarget.id)
    app.updateInfo('order_master', e.currentTarget.id, {
      sending: true,      // 确保配送状态为true
      finished: true,     // 设置完成状态为true
      finishedTime: app.CurrentTime_show()
    }, e => {
      that.getAllList()
      wx.showToast({
        title: '【已送达】',
      })
    })
  },

  // 打电话功能
  makePhoneCall: function(e) {
    const phoneNumber = e.currentTarget.dataset.phone
    console.log('准备拨打电话:', phoneNumber)
    
    if (!phoneNumber) {
      wx.showToast({
        title: '电话号码为空',
        icon: 'none'
      })
      return
    }

    wx.makePhoneCall({
      phoneNumber: phoneNumber,
      success: function() {
        console.log('拨打电话成功')
      },
      fail: function(err) {
        console.error('拨打电话失败:', err)
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        })
      }
    })
  }
})