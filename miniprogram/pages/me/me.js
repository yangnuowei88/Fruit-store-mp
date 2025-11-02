// page/component/new-pages/user/user.js
const app = getApp();

Page({
  data: {
    orders: [],
    hasAddress: false,
    address: {},
    openid: '',
    // 用户角色信息
    userRole: 'user', // admin, rider, user
    userName: '',
    userPhone: '',
    // 权限配置
    permissions: {
      canViewBackend: false,      // 后台管理
      canViewOrderManage: false,  // 订单管理
      canViewRiderManage: false   // 骑手配送
    },
    // 加载状态
    roleLoading: true
  },
  onLoad() {
    var that = this;
    that.getUserRoleAndOrders();
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
    that.getUserRoleAndOrders()
    var timer

    (timer = setTimeout(function () {
      wx.stopPullDownRefresh()
    }, 500));

  },

  // 获取用户角色和订单信息
  getUserRoleAndOrders() {
    var that = this;
    
    // 设置加载状态
    that.setData({
      roleLoading: true
    });

    // 先获取用户角色信息
    wx.cloud.callFunction({
      name: 'getUserRole',
      success: res => {
        console.log('获取用户角色成功:', res.result);
        
        if (res.result.success) {
          const userData = res.result.data;
          
          // 更新用户信息和权限
          that.setData({
            openid: userData.openid,
            userRole: userData.role,
            userName: userData.name,
            userPhone: userData.phone,
            permissions: userData.permissions,
            roleLoading: false
          });

          console.log('用户权限配置:', userData.permissions);
          
          // 获取订单信息
          that.getOrdersByOpenid(userData.openid);
          
        } else {
          console.error('获取用户角色失败:', res.result.error);
          // 设置默认权限
          that.setData({
            userRole: 'user',
            permissions: {
              canViewBackend: false,
              canViewOrderManage: false,
              canViewRiderManage: false
            },
            roleLoading: false
          });
        }
      },
      fail: err => {
        console.error('调用getUserRole云函数失败:', err);
        
        // 降级处理：使用原有的add云函数获取openid
        wx.cloud.callFunction({
          name: 'add',
          success: res => {
            console.log('降级获取openid成功:', res.result.openId);
            const openid = res.result.openId;
            
            that.setData({
              openid: openid,
              userRole: 'user',
              permissions: {
                canViewBackend: false,
                canViewOrderManage: false,
                canViewRiderManage: false
              },
              roleLoading: false
            });
            
            // 获取订单信息
            that.getOrdersByOpenid(openid);
          },
          fail: addErr => {
            console.error('降级获取openid也失败:', addErr);
            that.setData({
              roleLoading: false
            });
          }
        });
      }
    });
  },

  // 根据openid获取订单信息
  getOrdersByOpenid(openid) {
    var that = this;
    
    console.log('🔍 开始查询订单，openid:', openid);
    
    // 使用getInfoByOrder按时间倒序查询所有订单，然后过滤当前用户的订单
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      console.log('📋 ===== 数据库查询结果详情 =====');
      console.log('查询方法: getInfoByOrder (按orderTime倒序)');
      console.log('查询结果状态:', e);
      console.log('查询到的总订单数量:', e.data ? e.data.length : 0);
      
      if (e.data && e.data.length > 0) {
        // 过滤出当前用户的订单
        const userOrders = e.data.filter(order => order.openid === openid);
        console.log('当前用户的订单数量:', userOrders.length);
        
        if (userOrders.length > 0) {
          console.log('📊 当前用户的原始订单数据:');
          userOrders.forEach((order, index) => {
            console.log(`订单 ${index + 1}:`, {
              _id: order._id,
              orderNumber: order.orderNumber,
              out_trade_no: order.out_trade_no,
              orderTime: order.orderTime,
              payTime: order.payTime,
              sendingTime: order.sendingTime,
              finishedTime: order.finishedTime,
              total: order.total,
              paySuccess: order.paySuccess,
              sending: order.sending,
              finished: order.finished,
              name: order.name,
              phone: order.phone,
              schoolName: order.schoolName,
              addressItem: order.addressItem,
              detail: order.detail,
              message: order.message,
              fruitList: order.fruitList
            });
          });
          
          // 格式化订单数据（已经按时间倒序排列，无需再次排序）
          const formattedOrders = userOrders.map(order => that.formatOrderData(order));
          
          console.log('✨ 格式化后的订单数据:');
          formattedOrders.forEach((order, index) => {
            console.log(`格式化订单 ${index + 1}:`, {
              _id: order._id,
              orderNumber: order.orderNumber,
              orderTime: order.orderTime,
              payTime: order.payTime,
              sendingTime: order.sendingTime,
              finishedTime: order.finishedTime,
              total: order.total,
              paySuccess: order.paySuccess,
              sending: order.sending,
              finished: order.finished,
              fruitList: order.fruitList
            });
          });
          
          that.setData({
            orders: formattedOrders
          });
          
          console.log('📱 页面数据已更新，当前显示订单数量:', formattedOrders.length);
        } else {
          console.log('⚠️ 当前用户没有订单数据');
          that.setData({
            orders: []
          });
        }
      } else {
        console.log('⚠️ 数据库中没有任何订单数据');
        that.setData({
          orders: []
        });
      }
    });
  },

  // 格式化订单数据
  formatOrderData(order) {
    // 格式化时间显示
    if (order.orderTime) {
      order.orderTime = this.formatTime(order.orderTime);
    }
    if (order.payTime) {
      order.payTime = this.formatTime(order.payTime);
    }
    if (order.sendingTime) {
      order.sendingTime = this.formatTime(order.sendingTime);
    }
    if (order.finishedTime) {
      order.finishedTime = this.formatTime(order.finishedTime);
    }

    // 确保订单号格式
    if (!order.orderNumber && order.out_trade_no) {
      order.orderNumber = order.out_trade_no;
    }

    // 确保总价格式
    if (order.total) {
      order.total = parseFloat(order.total).toFixed(2);
    }

    return order;
  },

  // 格式化时间显示
  formatTime(timeStr) {
    if (!timeStr) return '';
    
    try {
      // 如果是时间戳，转换为日期
      let date;
      if (typeof timeStr === 'number') {
        date = new Date(timeStr);
      } else {
        date = new Date(timeStr);
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return timeStr; // 如果无法解析，返回原始字符串
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const orderDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const diffTime = today.getTime() - orderDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const timeString = date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      if (diffDays === 0) {
        return `今天 ${timeString}`;
      } else if (diffDays === 1) {
        return `昨天 ${timeString}`;
      } else if (diffDays === 2) {
        return `前天 ${timeString}`;
      } else {
        return date.toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit'
        }) + ` ${timeString}`;
      }
    } catch (error) {
      console.error('时间格式化错误:', error);
      return timeStr;
    }
  },

  // 后台管理按钮点击
  toBackend: function() {
    if (!this.data.permissions.canViewBackend) {
      wx.showToast({
        title: '权限不足',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/bgInfo/bgInfo',
    });
  },

  // 订单管理按钮点击
  toOrderManage: function() {
    if (!this.data.permissions.canViewOrderManage) {
      wx.showToast({
        title: '权限不足',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/bgManage/bgManage',
    });
  },

  // 骑手配送按钮点击
  toRiderManage: function() {
    if (!this.data.permissions.canViewRiderManage) {
      wx.showToast({
        title: '权限不足',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/riderManage/riderManage',
    });
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
  },

  // 长按个人中心标题事件
  onLongPressTitle: function() {
    const that = this;
    
    // 如果已经是骑手或管理员，不需要操作
    if (this.data.userRole === 'rider' || this.data.userRole === 'admin') {
      wx.showToast({
        title: '您已经是' + (this.data.userRole === 'admin' ? '管理员' : '骑手'),
        icon: 'none'
      });
      return;
    }

    // 显示邀请码输入对话框
    that.showInviteCodeInput();
  },

  // 显示邀请码输入对话框
  showInviteCodeInput: function() {
    const that = this;
    
    wx.showModal({
      title: '申请成为骑手',
      content: '请输入4位数字邀请码',
      editable: true,
      placeholderText: '请输入邀请码',
      confirmText: '验证',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          const inviteCode = res.content.trim();
          if (that.validateInviteCode(inviteCode)) {
            // 邀请码验证通过，显示确认对话框
            that.showUpgradeConfirmation();
          } else {
            // 邀请码验证失败
            wx.showModal({
              title: '邀请码错误',
              content: '邀请码必须是4位数字且以36结尾，请重新输入',
              showCancel: true,
              confirmText: '重新输入',
              cancelText: '取消',
              success: function(retryRes) {
                if (retryRes.confirm) {
                  // 重新显示输入框
                  that.showInviteCodeInput();
                }
              }
            });
          }
        }
      }
    });
  },

  // 验证邀请码
  validateInviteCode: function(code) {
    // 检查是否为4位数字
    if (!/^\d{4}$/.test(code)) {
      return false;
    }
    
    // 检查是否以36结尾
    if (!code.endsWith('36')) {
      return false;
    }
    
    return true;
  },

  // 显示升级确认对话框
  showUpgradeConfirmation: function() {
    const that = this;
    
    wx.showModal({
      title: '邀请码验证成功',
      content: '邀请码验证通过！确定要成为骑手吗？成为骑手后可以接收配送任务。',
      confirmText: '确定申请',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          that.upgradeToRider();
        }
      }
    });
  },

  // 升级为骑手角色
  upgradeToRider: function() {
    const that = this;
    
    wx.showLoading({
      title: '正在申请...'
    });

    // 调用云函数更新用户角色
    wx.cloud.callFunction({
      name: 'updateUserRole',
      data: {
        role: 'rider'
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.result.success) {
          wx.showToast({
            title: '申请成功！',
            icon: 'success'
          });
          
          // 更新本地数据
          that.setData({
            userRole: 'rider',
            'permissions.canViewRiderManage': true
          });
          
          // 重新获取用户信息
          setTimeout(() => {
            that.getUserRoleAndOrders();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '申请失败',
            icon: 'none'
          });
        }
      },
      fail: function(error) {
        wx.hideLoading();
        console.error('升级骑手角色失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  }

})