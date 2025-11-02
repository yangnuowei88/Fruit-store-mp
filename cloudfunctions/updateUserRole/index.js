// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    const { role } = event
    
    // 验证角色参数
    if (!role || !['admin', 'rider', 'user'].includes(role)) {
      return {
        success: false,
        message: '无效的角色参数'
      }
    }
    
    // 查询用户是否存在
    const userQuery = await db.collection('user').where({
      openid: openid
    }).get()
    
    const currentTime = new Date()
    
    if (userQuery.data.length > 0) {
      // 用户存在，更新角色
      const currentUser = userQuery.data[0]
      
      // 如果已经是管理员，不允许降级
      if (currentUser.role === 'admin' && role !== 'admin') {
        return {
          success: false,
          message: '管理员角色不能更改'
        }
      }
      
      // 更新用户角色
      await db.collection('user').doc(currentUser._id).update({
        data: {
          role: role,
          updateTime: currentTime
        }
      })
      
      console.log(`用户 ${openid} 角色已更新为: ${role}`)
      
    } else {
      // 用户不存在，创建新用户记录
      await db.collection('user').add({
        data: {
          openid: openid,
          role: role,
          name: '',
          phone: '',
          status: 'active',
          createTime: currentTime,
          updateTime: currentTime
        }
      })
      
      console.log(`新用户 ${openid} 已创建，角色: ${role}`)
    }
    
    // 返回更新后的权限配置
    let permissions = {
      canViewBackend: false,
      canViewOrderManage: false,
      canViewRiderManage: false
    }
    
    switch (role) {
      case 'admin':
        permissions = {
          canViewBackend: true,
          canViewOrderManage: true,
          canViewRiderManage: true
        }
        break
      case 'rider':
        permissions = {
          canViewBackend: false,
          canViewOrderManage: false,
          canViewRiderManage: true
        }
        break
      case 'user':
      default:
        // 普通用户无特殊权限
        break
    }
    
    return {
      success: true,
      message: '角色更新成功',
      data: {
        openid: openid,
        role: role,
        permissions: permissions
      }
    }
    
  } catch (error) {
    console.error('更新用户角色失败:', error)
    return {
      success: false,
      message: '服务器错误，请稍后重试',
      error: error.message
    }
  }
}