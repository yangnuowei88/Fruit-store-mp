// 调试脚本：查询数据库中的实际订单数据
const app = getApp()

Page({
  data: {
    allOrders: [],
    shippingOrders: [],
    debugInfo: ''
  },

  onLoad() {
    this.queryAllOrders()
  },

  // 查询所有订单数据
  queryAllOrders() {
    const that = this
    console.log('🔍 开始查询数据库中的所有订单...')
    
    app.getInfoByOrder('order_master', 'orderTime', 'desc', (res) => {
      console.log('📊 数据库查询结果:', res)
      
      if (res.data && res.data.length > 0) {
        const allOrders = res.data
        console.log(`📋 总订单数: ${allOrders.length}`)
        
        // 分析每个订单的状态
        let debugInfo = `总订单数: ${allOrders.length}\n\n`
        
        allOrders.forEach((order, index) => {
          debugInfo += `=== 订单 ${index + 1} ===\n`
          debugInfo += `ID: ${order._id}\n`
          debugInfo += `支付状态: ${order.paySuccess ? '已支付' : '未支付'}\n`
          debugInfo += `发货状态: ${order.sending ? '已发货' : '未发货'}\n`
          debugInfo += `完成状态: ${order.finished ? '已完成' : '未完成'}\n`
          debugInfo += `打印状态: ${order.printed ? '已打印' : '未打印'}\n`
          debugInfo += `发货时间: ${order.sendingTime || '无'}\n`
          debugInfo += `完成时间: ${order.finishedTime || '无'}\n`
          debugInfo += `订单时间: ${order.orderTime}\n`
          debugInfo += `总价: ${order.total}\n\n`
        })
        
        // 筛选不同状态的订单
        const shippingOrders = allOrders.filter(order => {
          return order.sending === true && order.finished !== true
        })
        
        const completedOrders = allOrders.filter(order => {
          return order.finished === true
        })
        
        const allShippedOrders = allOrders.filter(order => {
          return order.sending === true  // 所有已发货的订单（包括已完成的）
        })
        
        debugInfo += `=== 订单状态统计 ===\n`
        debugInfo += `配送中订单数 (sending=true && finished=false): ${shippingOrders.length}\n`
        debugInfo += `已完成订单数 (finished=true): ${completedOrders.length}\n`
        debugInfo += `所有已发货订单数 (sending=true): ${allShippedOrders.length}\n\n`
        
        if (shippingOrders.length > 0) {
          debugInfo += `=== 配送中订单详情 ===\n`
          shippingOrders.forEach((order, index) => {
            debugInfo += `${index + 1}. ID: ${order._id}\n`
            debugInfo += `   发货时间: ${order.sendingTime}\n`
            debugInfo += `   总价: ${order.total}\n\n`
          })
        } else {
          debugInfo += '❌ 没有找到配送中订单！\n\n'
        }
        
        if (allShippedOrders.length > 0) {
          debugInfo += `=== 所有已发货订单详情 ===\n`
          allShippedOrders.forEach((order, index) => {
            debugInfo += `${index + 1}. ID: ${order._id}\n`
            debugInfo += `   发货状态: ${order.sending ? '已发货' : '未发货'}\n`
            debugInfo += `   完成状态: ${order.finished ? '已完成' : '未完成'}\n`
            debugInfo += `   发货时间: ${order.sendingTime || '无'}\n`
            debugInfo += `   完成时间: ${order.finishedTime || '无'}\n\n`
          })
        }
        
        that.setData({
          allOrders: allOrders,
          shippingOrders: shippingOrders,
          debugInfo: debugInfo
        })
        
        console.log('🔍 调试信息:', debugInfo)
        
      } else {
        const errorInfo = '❌ 数据库中没有找到任何订单数据！'
        that.setData({
          debugInfo: errorInfo
        })
        console.log(errorInfo)
      }
    })
  },

  // 手动触发发货测试
  testShipping() {
    const that = this
    const orders = this.data.allOrders
    
    if (orders.length === 0) {
      wx.showToast({
        title: '没有订单数据',
        icon: 'none'
      })
      return
    }
    
    // 找到第一个已支付但未发货的订单
    const pendingOrder = orders.find(order => 
      order.paySuccess === true && 
      order.sending !== true && 
      order.finished !== true
    )
    
    if (pendingOrder) {
      console.log('🚚 测试发货订单:', pendingOrder._id)
      
      // 更新订单为发货状态
      app.updateInfo('order_master', pendingOrder._id, {
        sending: true,
        sendingTime: app.CurrentTime_show()
      }, () => {
        console.log('✅ 测试发货成功')
        wx.showToast({
          title: '测试发货成功',
          icon: 'success'
        })
        
        // 重新查询数据
        setTimeout(() => {
          that.queryAllOrders()
        }, 1000)
      })
    } else {
      wx.showToast({
        title: '没有可发货的订单',
        icon: 'none'
      })
    }
  },

  // 复制调试信息
  copyDebugInfo() {
    wx.setClipboardData({
      data: this.data.debugInfo,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  }
})