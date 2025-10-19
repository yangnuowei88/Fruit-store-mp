// miniprogram/pages/bgInfo/bgInfo.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    fruitInfo: {},
    tmpUrlArr: [],
    delFruitId: "",
    cardNum: 1,
    files: [],
    time:0,
    manageList:[], //管理页面信息列表

    // 上传的信息
    fruitID:null, //水果编号
    name:null,    //水果名称
    price:null,   //价格
    unit:null,    //单位
    detail:"",    //描述
    myClass:0,    //今日特惠
    recommend:0,  //店主推荐
    onShow:true,  //上架

    myClass_Arr: [
      '否',
      '是'
    ],
    recommend_Arr: [
      '否',
      '是'
    ],
    reFresh:null,

    // 营业统计数据
    todayStats: {
      revenue: '0.00',
      orderCount: 0,
      completedCount: 0,
      avgAmount: '0.00'
    },
    weekStats: {
      revenue: '0.00',
      orderCount: 0
    },
    monthStats: {
      revenue: '0.00',
      orderCount: 0
    },
    orderStatus: {
      pending: 0,
      shipping: 0,
      completed: 0
    }
  },

  //------------------------!!! 获取信息 !!!------------------------
  // 获取水果编号
  getFruitID: function (e) {
    this.setData({
      fruitID: parseInt(e.detail.value)
    })
  },

  // 获取水果名称
  getName: function (e) {
    this.setData({
      name: e.detail.value
    })
  },

  // 获取价格
  getPrice: function (e) {
    this.setData({
      price: e.detail.value
    })
  },

  // 获取单位
  getUnit: function (e) {
    this.setData({
      unit: e.detail.value
    })
  },

  //选择照片并预览（预览地址在files，上传后的地址在tmpUrlArr）
  chooseImage: function (e) {
    var that = this;
    wx.chooseImage({
      success: function (res) {
        that.setData({
          files: that.data.files.concat(res.tempFilePaths)
        });
        
        app.upToClound("imgSwiper", that.data.name + Math.random().toString(), 
        res.tempFilePaths["0"], tmpUrl => {
          // console.log(tmpUrl)
          that.data.tmpUrlArr.push(tmpUrl)
          // console.log(getCurrentPages())
        })
      }
    })
    // console.log(getCurrentPages())
  },

  //预览图片
  previewImage: function (e) {
    var that = this
    wx.previewImage({
      current: e.currentTarget.id, // 当前显示图片的http链接
      urls: that.data.tmpUrlArr // 需要预览的图片http链接列表
    })
  },

  //水果详细信息
  getInfoText: function (e) {
    var that = this
    that.setData({

    })
    this.data.detail = e.detail.value;
  },

  // 今日特惠
  getMyClass: function (e) {
    var that = this
    this.setData({
      myClass: e.detail.value.toString()
    })
  },

  // 店主推荐
  getRecommend: function (e) {
    var that = this
    this.setData({
      recommend: e.detail.value.toString()
    })
  },

  // --------------------!!!  选项卡切换  !!!----------------------
  tapTo1: function() {  //添加
    var that = this
    that.setData({
      cardNum: 1
    })
  },
  tapTo2: function () { //修改和删除
    var that = this
    that.setData({
      cardNum: 2
    })
    // console.log(getCurrentPages())
  }, 
  tapTo3: function () {
    var that = this
    that.setData({
      cardNum: 3
    })
  },
  tapTo4: function () { // 营业统计
    var that = this
    that.setData({
      cardNum: 4
    })
    // 切换到统计页面时获取统计数据
    that.getStatistics()
  },

  // ----------------------!!!  提交操作  !!!---------------------
  // 添加水果信息表单
  addFruitInfo: function(e){
    const that = this
    if (that.data.name && that.data.price){
      new Promise((resolve, reject) => {
        const { fruitID, name, price, unit, detail, myClass, recommend, tmpUrlArr, onShow } = that.data
        const theInfo = { fruitID, name, price, unit, detail, myClass, recommend, tmpUrlArr, onShow }
        theInfo['imgUrl'] = that.data.tmpUrlArr[0]
        theInfo['time'] = parseInt(app.CurrentTime())
        resolve(theInfo)
      }).then(theInfo => {
        // 上传所有信息
        app.addRowToSet('fruit-board', theInfo, e => {
          console.log(e)
          wx.showToast({
            title: '添加成功',
          })
        })
        app.getInfoByOrder('fruit-board', 'time', 'desc',
          e => {
            that.setData({
              manageList: e.data
            })
          }
        )
      })
    }
    else{
      wx.showToast({
        title: '信息不完全',
      })
    }
    
  },

  // ----------------------!!!  修改水果参数  !!!----------------------
  // 上架水果
  upToLine:function(e){
    var that = this
    // console.log(e.currentTarget.id)
    app.updateInfo('fruit-board', e.currentTarget.id,{
      onShow: true
    },e=>{
      that.getManageList()
      wx.showToast({
        title: '已上架',
      })
    })
  },
  
  // 下架水果
  downFromLine: function (e) {
    var that = this
    // console.log(e.currentTarget.id)
    app.updateInfo('fruit-board', e.currentTarget.id, {
      onShow: false
    }, e => {
      that.getManageList()
      wx.showToast({
        title: '已下架',
      })
    })
  },

  // 绑定删除水果名称参数
  getDelFruitId: function(e) {
    var that = this
    app.getInfoWhere('fruit-board',{
      name: e.detail.value
    },res=>{
      that.setData({
        delFruitId: res.data["0"]._id
      })
    })
  },

  // 删除水果
  deleteFruit: function() {
    // app.deleteInfoFromSet('fruit-board',"葡萄")
    var that = this
    console.log(that.data.delFruitId)
    new Promise((resolve,reject)=>{
      app.deleteInfoFromSet('fruit-board', that.data.delFruitId)
    })
    .then(that.getManageList())
  },

  // 程序下线打烊
  offLine: function () {
    var that = this
    app.getInfoWhere('setting', {
      option: "offLine"
    }, res => {
      let ch = !res.data["0"].offLine
      app.updateInfo('setting', res.data["0"]._id,{
        offLine: ch
      },e=>{
        wx.showToast({
          title: '操作成功',
        })
      })
      // console.log(res)
    })
  },


  /**
   * ----------------------!!!  生命周期函数--监听页面加载  !!!----------------------
   */
  getManageList:function(){
    var that = this
    app.getInfoByOrder('fruit-board', 'time', 'desc',
      e => {
        that.setData({
          manageList: e.data
        })
      }
    )
  },

  onLoad: function (options) {
    this.getManageList()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.getManageList()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    (timer = setTimeout(function () {
      wx.stopPullDownRefresh()
    }, 500));

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  // ----------------------!!!  营业统计功能  !!!----------------------
  
  // 获取所有统计数据
  getStatistics: function() {
    const that = this
    
    console.log('=== 开始获取统计数据 ===')
    
    // 尝试获取真实订单数据
    try {
      app.getInfoByOrder('order_master', 'orderTime', 'desc', (res) => {
        console.log('数据库查询结果:', res)
        if (res.data && res.data.length > 0) {
          const orders = res.data
          console.log('获取到订单数据，总数:', orders.length)
          
          // 打印所有订单的基本信息
          orders.forEach((order, index) => {
            console.log(`订单${index + 1} 基本信息:`, {
              _id: order._id,
              orderTime: order.orderTime,
              orderStatus: order.orderStatus,
              total: order.total,
              paySuccess: order.paySuccess
            })
          })
          
          // 计算各项统计数据
          that.calculateTodayStats(orders)
          that.calculateWeekStats(orders)
          that.calculateMonthStats(orders)
          that.calculateOrderStatus(orders)
        } else {
          console.log('暂无订单数据，设置默认值')
          // 设置默认的空数据
          that.setData({
            todayStats: {
              revenue: '0.00',
              orderCount: 0,
              completedCount: 0,
              avgAmount: '0.00'
            },
            weekStats: {
              revenue: '0.00',
              orderCount: 0
            },
            monthStats: {
              revenue: '0.00',
              orderCount: 0
            },
            orderStatus: {
              pending: 0,
              shipping: 0,
              completed: 0
            }
          })
        }
      })
    } catch (error) {
      console.log('获取订单数据失败:', error)
      wx.showToast({
        title: '数据加载失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 计算今日统计
  calculateTodayStats: function(orders) {
    console.log('=== 开始计算今日统计 ===')
    const today = new Date()
    const todayStr = this.formatDate(today)
    console.log('今天日期:', todayStr)
    console.log('订单总数:', orders.length)
    
    let todayRevenue = 0
    let todayOrderCount = 0
    let todayCompletedCount = 0
    let todayPaidCount = 0
    
    // 特别查找一分钱订单
    const oneCentOrder = orders.find(order => 
      order._id === '4ea4942768f0923902f7573a2c908863' || 
      parseFloat(order.total) === 0.01
    )
    if (oneCentOrder) {
      console.log('🔍 找到一分钱订单:', {
        _id: oneCentOrder._id,
        orderTime: oneCentOrder.orderTime,
        orderStatus: oneCentOrder.orderStatus,
        total: oneCentOrder.total,
        paySuccess: oneCentOrder.paySuccess
      })
    } else {
      console.log('❌ 未找到一分钱订单')
    }
    
    orders.forEach((order, index) => {
      const isOneCentOrder = order._id === '4ea4942768f0923902f7573a2c908863' || parseFloat(order.total) === 0.01
      
      if (isOneCentOrder) {
        console.log(`\n🎯 === 处理一分钱订单 ${index + 1} ===`)
      } else {
        console.log(`\n--- 处理订单 ${index + 1} ---`)
      }
      
      console.log('订单ID:', order._id)
      console.log('订单时间原始值:', order.orderTime)
      console.log('订单时间类型:', typeof order.orderTime)
      
      const orderDate = new Date(order.orderTime || '')
      console.log('解析后的Date对象:', orderDate)
      console.log('Date对象是否有效:', !isNaN(orderDate.getTime()))
      
      const orderDateStr = this.formatDate(orderDate)
      console.log('格式化后的订单日期:', orderDateStr)
      console.log('今天日期:', todayStr)
      console.log('日期是否匹配:', orderDateStr === todayStr)
      
      console.log('订单状态:', order.orderStatus)
      console.log('订单金额原始值:', order.total)
      console.log('订单金额类型:', typeof order.total)
      console.log('解析后金额:', parseFloat(order.total || 0))
      
      if (orderDateStr === todayStr) {
        console.log('✓ 这是今天的订单')
        todayOrderCount++
        
        // 计算营业额（所有已支付的订单：待发货、配送中、已完成，或者paySuccess为true）
        const isPaidByStatus = order.orderStatus === '待发货' || order.orderStatus === '配送中' || order.orderStatus === '已完成'
        const isPaidByFlag = order.paySuccess === true
        
        console.log('支付状态检查:')
        console.log('  - 按状态判断已支付:', isPaidByStatus)
        console.log('  - 按paySuccess判断已支付:', isPaidByFlag)
        console.log('  - paySuccess字段值:', order.paySuccess)
        
        if (isPaidByStatus || isPaidByFlag) {
          console.log('✓ 这是已支付订单，计入营业额')
          const amount = parseFloat(order.total || 0)
          console.log('订单金额数值:', amount)
          todayRevenue += amount
          todayPaidCount++
          
          if (isOneCentOrder) {
            console.log('🎯 一分钱订单已计入营业额!')
          }
        } else {
          console.log('✗ 订单状态不符合已支付条件')
          console.log('  当前状态:', order.orderStatus)
          console.log('  paySuccess:', order.paySuccess)
          if (isOneCentOrder) {
            console.log('🎯 一分钱订单未计入营业额，状态不符合!')
          }
        }
        
        // 计算已完成订单数
        if (order.orderStatus === '已完成') {
          console.log('✓ 这是已完成订单')
          todayCompletedCount++
        }
      } else {
        console.log('✗ 不是今天的订单，跳过')
        if (isOneCentOrder) {
          console.log('🎯 一分钱订单不是今天的订单!')
        }
      }
    })
    
    const avgAmount = todayPaidCount > 0 ? (todayRevenue / todayPaidCount).toFixed(2) : '0.00'
    
    this.setData({
      todayStats: {
        revenue: todayRevenue.toFixed(2),
        orderCount: todayOrderCount,
        completedCount: todayCompletedCount,
        avgAmount: avgAmount
      }
    })
    
    console.log('=== 今日统计计算完成 ===')
    console.log('今日营业额:', todayRevenue.toFixed(2))
    console.log('今日订单数:', todayOrderCount)
    console.log('今日已完成:', todayCompletedCount)
    console.log('今日已支付:', todayPaidCount)
    console.log('平均金额:', avgAmount)
  },

  // 计算本周统计
  calculateWeekStats: function(orders) {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay()) // 本周开始日期
    
    let weekRevenue = 0
    let weekOrderCount = 0
    
    orders.forEach(order => {
      const orderDate = new Date(order.orderTime || '')
      
      if (orderDate >= weekStart && orderDate <= today) {
        weekOrderCount++
        
        // 计算营业额（所有已支付的订单：待发货、配送中、已完成）
        if (order.orderStatus === '待发货' || order.orderStatus === '配送中' || order.orderStatus === '已完成') {
          const amount = parseFloat(order.total || 0)
          weekRevenue += amount
        }
      }
    })
    
    this.setData({
      weekStats: {
        revenue: weekRevenue.toFixed(2),
        orderCount: weekOrderCount
      }
    })
    
    console.log('本周统计计算完成:', {
      weekStart: this.formatDate(weekStart),
      weekRevenue,
      weekOrderCount
    })
  },

  // 计算本月统计
  calculateMonthStats: function(orders) {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    
    let monthRevenue = 0
    let monthOrderCount = 0
    
    orders.forEach(order => {
      const orderDate = new Date(order.orderTime || '')
      
      if (orderDate >= monthStart && orderDate <= today) {
        monthOrderCount++
        
        // 计算营业额（所有已支付的订单：待发货、配送中、已完成）
        if (order.orderStatus === '待发货' || order.orderStatus === '配送中' || order.orderStatus === '已完成') {
          const amount = parseFloat(order.total || 0)
          monthRevenue += amount
        }
      }
    })
    
    this.setData({
      monthStats: {
        revenue: monthRevenue.toFixed(2),
        orderCount: monthOrderCount
      }
    })
    
    console.log('本月统计计算完成:', {
      monthStart: this.formatDate(monthStart),
      monthRevenue,
      monthOrderCount
    })
  },

  // 计算订单状态统计
  calculateOrderStatus: function(orders) {
    let pending = 0    // 待发货
    let shipping = 0   // 配送中
    let completed = 0  // 已完成
    
    orders.forEach(order => {
      if (order.orderStatus === '已完成') {
        completed++
      } else if (order.orderStatus === '配送中') {
        shipping++
      } else if (order.orderStatus === '待发货') {
        pending++
      }
    })
    
    this.setData({
      orderStatus: {
        pending: pending,
        shipping: shipping,
        completed: completed
      }
    })
    
    console.log('订单状态统计完成:', {
      pending,
      shipping,
      completed,
      total: orders.length
    })
  },

  // 刷新统计数据
  refreshStats: function() {
    wx.showLoading({
      title: '刷新中...'
    })
    
    this.getStatistics()
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      })
    }, 1000)
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate: function(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

})