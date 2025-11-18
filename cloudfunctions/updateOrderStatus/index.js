// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { orderId, updates } = event || {}
    if (!orderId || typeof orderId !== 'string') {
      return { success: false, message: '缺少有效的订单ID' }
    }
    if (!updates || typeof updates !== 'object') {
      return { success: false, message: '缺少更新字段' }
    }

    const res = await db.collection('order_master').doc(orderId).update({
      data: updates
    })

    return {
      success: true,
      stats: res && res.stats ? res.stats : { updated: 0 },
      message: '订单状态已更新'
    }
  } catch (error) {
    console.error('updateOrderStatus 云函数失败:', error)
    return { success: false, message: '云函数更新失败', error: error && error.message }
  }
}