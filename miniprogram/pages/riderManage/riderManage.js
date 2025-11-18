// pages/riderManage/riderManage.js
const app = getApp()

Page({
  data: {
    orderList: [],
    displayOrderList: [],
    pendingDeliveryCount: 0,  // 待配送订单数量
    totalOrderCount: 0,       // 总订单数量
    // 分页状态
    page: 0,
    pageSize: 20,
    hasMore: true,
    loadingMore: false
  },

  onLoad: function (options) {
    this.resetRiderPagination()
    this.loadRiderPage()
    this.updateCounts()
  },

  onShow: function () {
    // 回到页面时保持现有分页加载逻辑
    if (this.data.orderList.length === 0) {
      this.resetRiderPagination()
      this.loadRiderPage()
    }
    this.updateCounts()
  },

  onPullDownRefresh: function () {
    this.resetRiderPagination()
    this.loadRiderPage()
    this.updateCounts()
    wx.stopPullDownRefresh()
  },

  // 重置分页
  resetRiderPagination: function () {
    this.setData({
      page: 0,
      hasMore: true,
      loadingMore: false,
      orderList: [],
      displayOrderList: []
    })
  },

  // 加载一页订单（按时间倒序）
  loadRiderPage: function () {
    const that = this
    if (that.data.loadingMore || !that.data.hasMore) return
    that.setData({ loadingMore: true })

    const { page, pageSize } = that.data
    // 仅查询待配送订单：sending=true 且 finished=false
    app.getInfoWhereAndOrderPaged('order_master', { sending: true, finished: false }, 'orderTime', 'desc', page, pageSize, res => {
      const rows = res && res.data ? res.data : []
      const merged = (that.data.orderList || []).concat(rows)
      const hasMore = rows.length >= pageSize
      const nextPage = hasMore ? page + 1 : page

      that.setData({
        orderList: merged,
        displayOrderList: merged,
        page: nextPage,
        hasMore: hasMore,
        loadingMore: false
      })
    })
  },

  // 统计总数与待配送数（不受分页影响）
  updateCounts: function () {
    const that = this
    // 总订单数
    app.countCollection('order_master', res => {
      const total = (res && res.total) ? res.total : 0
      that.setData({ totalOrderCount: total })
    })
    // 待配送订单：sending=true 且 finished=false
    app.countInfoWhere('order_master', { sending: true, finished: false }, res => {
      const pending = (res && res.total) ? res.total : 0
      that.setData({ pendingDeliveryCount: pending })
    })
  },

  // 确认送达（复用bgManage的sendingFruit逻辑）
  sendingFruit: function(e) {
    var that = this
    const orderId = (e && e.currentTarget && (e.currentTarget.dataset && e.currentTarget.dataset.id)) || (e && e.currentTarget && e.currentTarget.id)
    if (!orderId) {
      console.error('确认送达失败：未获取到订单ID', e)
      wx.showToast({ title: '未获取到订单ID', icon: 'none' })
      return
    }
    console.log('确认送达（云函数），订单ID:', orderId)
    wx.showLoading({ title: '更新中…', mask: true })

    wx.cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId: orderId,
        updates: {
          sending: true,
          finished: true,
          finishedTime: app.CurrentTime_show()
        }
      }
    }).then(cfRes => {
      const stats = cfRes && cfRes.result && cfRes.result.stats
      const cfUpdated = stats && typeof stats.updated === 'number' ? stats.updated : 0
      if (cfUpdated > 0) {
        that.resetRiderPagination()
        that.loadRiderPage()
        that.updateCounts()
        wx.showToast({ title: '【已送达】' })
      } else {
        console.error('云函数更新失败或无变化:', cfRes)
        wx.showToast({ title: '更新失败或无变化', icon: 'none' })
      }
      wx.hideLoading()
    }).catch(err => {
      console.error('云函数调用失败:', err)
      wx.showToast({ title: '云函数调用失败', icon: 'none' })
      wx.hideLoading()
    })
  },

  // 触底加载下一页
  onReachBottom: function () {
    this.loadRiderPage()
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