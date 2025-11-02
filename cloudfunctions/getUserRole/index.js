// 云函数：获取用户角色信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    console.log('开始查询用户角色，openid:', openid)
    
    // 查询用户角色信息
    const userResult = await db.collection('user')
      .where({
        openid: openid
      })
      .get()

    console.log('用户查询结果:', userResult)

    let userRole = 'user' // 默认为普通用户
    let userName = ''
    let userPhone = ''

    if (userResult.data && userResult.data.length > 0) {
      const userData = userResult.data[0]
      userRole = userData.role || 'user'
      userName = userData.name || ''
      userPhone = userData.phone || ''
      
      console.log('找到用户信息:', {
        openid: openid,
        role: userRole,
        name: userName
      })
    } else {
      console.log('未找到用户信息，创建默认用户记录')
      
      // 如果用户不存在，创建默认用户记录
      try {
        await db.collection('user').add({
          data: {
            openid: openid,
            role: 'user',
            name: '',
            phone: '',
            status: 'active',
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        console.log('默认用户记录创建成功')
      } catch (addError) {
        console.error('创建默认用户记录失败:', addError)
      }
    }

    return {
      success: true,
      data: {
        openid: openid,
        role: userRole,
        name: userName,
        phone: userPhone,
        permissions: getUserPermissions(userRole)
      }
    }

  } catch (error) {
    console.error('获取用户角色失败:', error)
    return {
      success: false,
      error: error.message,
      data: {
        openid: openid,
        role: 'user', // 出错时默认为普通用户
        name: '',
        phone: '',
        permissions: getUserPermissions('user')
      }
    }
  }
}

// 根据角色获取权限配置
function getUserPermissions(role) {
  const permissions = {
    admin: {
      canViewBackend: true,      // 后台管理
      canViewOrderManage: true,  // 订单管理
      canViewRiderManage: true   // 骑手配送
    },
    rider: {
      canViewBackend: false,     // 后台管理
      canViewOrderManage: false, // 订单管理
      canViewRiderManage: true   // 骑手配送
    },
    user: {
      canViewBackend: false,     // 后台管理
      canViewOrderManage: false, // 订单管理
      canViewRiderManage: false  // 骑手配送
    }
  }

  return permissions[role] || permissions.user
}