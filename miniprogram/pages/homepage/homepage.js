// miniprogram/pages/homepage/homepage.js


const app = getApp()

Page({
  data: {
    swiperImgNo: 1,
    imgSwiperUrl: '',
    fruitInfo: [],
    typeCat: [
      { id: 0, name: "美味鲜果" },
      { id: 1, name: "精品饭食" },
      { id: 2, name: "新鲜上架" },
      { id: 3, name: "店主推荐" },
    ],
    activeTypeId: 0,
    isShow:true, 
    openid: '',   
    offLine:null,  //是否维护
    // 分页
    page: 0,
    pageSize: 20,
    hasMore: true,
    loadingMore: false
  },

  // 纯水果订单模拟
  mockFruitOrder() {
    this.createMockOrder('fruit');
  },

  // 纯盒饭订单模拟
  mockBoxlunchOrder() {
    this.createMockOrder('boxlunch');
  },

  // 混合订单模拟
  mockMixedOrder() {
    this.createMockOrder('mixed');
  },

  // 通用的模拟订单创建函数
  createMockOrder(orderType) {
    const that = this;
    
    // 显示加载提示
    wx.showLoading({
      title: `正在生成${orderType === 'fruit' ? '纯水果' : orderType === 'boxlunch' ? '纯盒饭' : '混合'}订单...`,
    });

    // 真实的商品数据池
    const realFruits = [
      ['红富士苹果', 2, 8.99, '斤', 'https://img.alicdn.com/imgextra/i1/725677994/O1CN01XQJKJ1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['新疆哈密瓜', 1, 18.80, '个', 'https://img.alicdn.com/imgextra/i2/725677994/O1CN01melon1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['泰国榴莲', 0.5, 68.00, '斤', 'https://img.alicdn.com/imgextra/i4/725677994/O1CN01durian1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['黄心猕猴桃', 1, 9.90, '斤', 'https://img.alicdn.com/imgextra/i4/725677994/O1CN01kiwi1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['脐橙', 1.5, 7.80, '斤', 'https://img.alicdn.com/imgextra/i2/725677994/O1CN01orange1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['海南椰子', 2, 12.50, '个', 'https://img.alicdn.com/imgextra/i3/725677994/O1CN01coconut1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['智利车厘子', 0.5, 89.00, '斤', 'https://img.alicdn.com/imgextra/i1/725677994/O1CN01cherry1Ks8XQZJ8Ks_!!725677994.jpg'],
      ['山东大樱桃', 1, 25.80, '斤', 'https://img.alicdn.com/imgextra/i2/725677994/O1CN01cherry2Ks8XQZJ8Ks_!!725677994.jpg']
    ];

    // 真实的盒饭数据池
    const realBoxlunches = [
      ['红烧肉盒饭', 1, 15.80, '份', 'https://img.alicdn.com/imgextra/i1/725677994/O1CN01boxlunch1_!!725677994.jpg'],
      ['宫保鸡丁盒饭', 1, 14.50, '份', 'https://img.alicdn.com/imgextra/i2/725677994/O1CN01chicken1_!!725677994.jpg'],
      ['糖醋里脊盒饭', 1, 16.00, '份', 'https://img.alicdn.com/imgextra/i3/725677994/O1CN01pork1_!!725677994.jpg'],
      ['麻婆豆腐盒饭', 1, 12.80, '份', 'https://img.alicdn.com/imgextra/i4/725677994/O1CN01tofu1_!!725677994.jpg'],
      ['鱼香肉丝盒饭', 1, 15.20, '份', 'https://img.alicdn.com/imgextra/i5/725677994/O1CN01fish1_!!725677994.jpg']
    ];

    // 根据订单类型选择商品池
    let availableProducts = [];
    let orderTypeText = '';
    
    switch(orderType) {
      case 'fruit':
        availableProducts = realFruits.map(item => [...item, 0]); // 只有水果，类型=0
        orderTypeText = '纯水果订单';
        break;
      case 'boxlunch':
        availableProducts = realBoxlunches.map(item => [...item, 1]); // 只有盒饭，类型=1
        orderTypeText = '纯盒饭订单';
        break;
      case 'mixed':
        availableProducts = [
          ...realFruits.map(item => [...item, 0]), // 水果类型=0
          ...realBoxlunches.map(item => [...item, 1]) // 盒饭类型=1
        ];
        orderTypeText = '混合订单';
        break;
    }

    // 真实的用户信息池
    const realUsers = [
      { name: '张三', phone: '13800138000' },
      { name: '李四', phone: '13900139000' },
      { name: '王五', phone: '15800158000' },
      { name: '赵六', phone: '18600186000' },
      { name: '陈七', phone: '17700177000' }
    ];

    // 真实的学校和地址信息池
    const realAddresses = [
      { schoolName: '交大', addressItem: '宿舍楼', detail: '1号楼101室', message: '请放在门口，谢谢' },
      { schoolName: '华师大', addressItem: '图书馆', detail: '图书馆前台', message: '请联系前台代收' },
      { schoolName: '复旦', addressItem: '学院', detail: '计算机学院办公室', message: '工作时间配送' },
      { schoolName: '同济', addressItem: '宿舍楼', detail: '2号楼205室', message: '晚上8点后配送' },
      { schoolName: '上大', addressItem: '食堂', detail: '第一食堂门口', message: '中午12点配送' }
    ];

    // 真实的订单备注池
    const realMessages = [
      '请轻拿轻放，水果易碎',
      '麻烦挑选新鲜一点的，谢谢',
      '如果没人请放在宿管处',
      '请在晚上7-9点配送',
      '有问题请及时联系我',
      '请选择成熟度适中的水果',
      '配送时请注意保鲜',
      '谢谢，辛苦了！'
    ];

    // 随机选择用户信息
    const randomUser = realUsers[Math.floor(Math.random() * realUsers.length)];
    const randomAddress = realAddresses[Math.floor(Math.random() * realAddresses.length)];
    const randomMessage = realMessages[Math.floor(Math.random() * realMessages.length)];

    // 根据订单类型选择商品数量
    let productCount;
    if (orderType === 'mixed') {
      productCount = Math.floor(Math.random() * 3) + 3; // 混合订单3-5种商品
    } else {
      productCount = Math.floor(Math.random() * 3) + 2; // 纯类型订单2-4种商品
    }
    
    const selectedFruits = [];
    const usedIndices = new Set();
    
    let totalAmount = 0;
    for (let i = 0; i < productCount; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * availableProducts.length);
      } while (usedIndices.has(randomIndex));
      
      usedIndices.add(randomIndex);
      const product = availableProducts[randomIndex];
      
      // 随机调整数量（在原基础上±50%）
      const baseQuantity = product[1];
      const adjustedQuantity = Math.max(0.5, baseQuantity * (0.5 + Math.random()));
      const roundedQuantity = Math.round(adjustedQuantity * 10) / 10; // 保留一位小数
      
      selectedFruits.push([product[0], roundedQuantity, product[2], product[5]]); // [名称, 数量, 价格, 类型]
      totalAmount += roundedQuantity * product[2];
    }

    // 生成订单号
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const orderNumber = `${year}${month}${day}${hour}${minute}${second}${random}`;

    // 构建订单数据
    const mockOrderData = {
      name: randomUser.name,
      phone: randomUser.phone,
      schoolName: randomAddress.schoolName,
      addressItem: randomAddress.addressItem,
      detail: randomAddress.detail,
      message: randomMessage,
      fruitList: selectedFruits,
      total: Math.round(totalAmount * 100) / 100, // 保留两位小数
      paySuccess: true,
      sending: false,
      finished: false,
      printed: false,
      printTime: '',
      time: new Date(),
      out_trade_no: 'MOCK_' + Date.now(),
      orderNumber: orderNumber,
      scenario: orderTypeText
    };

    console.log(`生成的${orderTypeText}数据:`, mockOrderData);

    // 将订单数据插入数据库
    app.addRowToSet('order_master', mockOrderData, (res) => {
      wx.hideLoading();
      console.log(`${orderTypeText}插入结果:`, res);
      
      if (res) {
        wx.showModal({
          title: `${orderTypeText}生成成功！`,
          content: `订单类型：${mockOrderData.scenario}\n订单号：${mockOrderData.orderNumber}\n客户姓名：${mockOrderData.name}\n总金额：￥${mockOrderData.total}\n支付状态：已完成\n\n订单已生成并完成支付，可在订单管理页面进行后续操作`,
          showCancel: false,
          confirmText: '确定',
          success: () => {
            // 可选：震动反馈
            wx.vibrateShort();
          }
        });
      } else {
        wx.showToast({
          title: '订单生成失败',
          icon: 'error'
        });
      }
    });
  },

  // 获取用户openid
  getOpenid() {
    let that = this;
    wx.cloud.callFunction({
      name: 'add',
      complete: res => {
        console.log('云函数获取到的openid: ', res.result.openId)
        var openid = res.result.openId;
        that.setData({
          openid: openid
        })
      }
    })
  },



  // ------------加入购物车------------
  addCartByHome: function(e) {
    // console.log(e.currentTarget.dataset._id)
    var self = this
    let newItem = {}
    app.getInfoWhere('fruit-board', { _id: e.currentTarget.dataset._id },
      e => {
        // console.log(e.data["0"])
        var newCartItem = e.data["0"]
        newCartItem.num = 1
        app.isNotRepeteToCart(newCartItem)
        wx.showToast({
          title: '已添加至购物车',
        })
      }
    )
  },


  // ------------分类展示切换---------
  typeSwitch: function(e) {
    // console.log(e.currentTarget.id)
    getCurrentPages()["0"].setData({
      activeTypeId: parseInt(e.currentTarget.id)
    })
    // 重置分页并加载第一页
    this.resetPagination()
    this.loadProductsPage()
  },

  // 重置分页状态
  resetPagination: function() {
    this.setData({
      page: 0,
      hasMore: true,
      loadingMore: false,
      fruitInfo: []
    })
  },

  // 加载当前分类下一页数据
  loadProductsPage: function() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.setData({ loadingMore: true })

    const db = wx.cloud.database()
    const _ = db.command
    const { activeTypeId, page, pageSize } = this.data

    const handleResult = (e) => {
      const list = Array.isArray(e.data) ? e.data : []
      const ids = list.filter(it => typeof it.imgUrl === 'string' && it.imgUrl.startsWith('cloud://')).map(it => it.imgUrl)

      const finalize = () => {
        const merged = (this.data.fruitInfo || []).concat(list)
        this.setData({
          fruitInfo: merged,
          page: this.data.page + 1,
          hasMore: list.length >= pageSize,
          loadingMore: false,
          isShow: true
        })
        wx.hideLoading()
      }

      if (ids.length) {
        wx.cloud.getTempFileURL({
          fileList: ids,
          success: res => {
            const map = {}
            ;(res.fileList || []).forEach(r => { if (r && r.fileID && r.tempFileURL) map[r.fileID] = r.tempFileURL })
            list.forEach(it => { if (map[it.imgUrl]) it.imgUrl = map[it.imgUrl] })
            finalize()
          },
          fail: err => {
            console.error('图片URL转换失败:', err)
            finalize()
          }
        })
      } else {
        finalize()
      }
    }

    switch (String(activeTypeId)) {
      case '0': // 美味鲜果（排除盒饭）
        app.getInfoWhereAndOrderPaged('fruit-board', {
          myClass: _.or(_.neq(1), _.exists(false))
        }, 'time', 'desc', page, pageSize, handleResult)
        break
      case '1': // 精品饭食（盒饭）
        app.getInfoWhereAndOrderPaged('fruit-board', { myClass: 1 }, 'time', 'desc', page, pageSize, handleResult)
        break
      case '2': // 新鲜上架（全部）
        app.getInfoByOrderPaged('fruit-board', 'time', 'desc', page, pageSize, handleResult)
        break
      case '3': // 店主推荐
        app.getInfoWhereAndOrderPaged('fruit-board', { recommend: '1' }, 'time', 'desc', page, pageSize, handleResult)
        break
      default:
        app.getInfoByOrderPaged('fruit-board', 'time', 'desc', page, pageSize, handleResult)
    }
  },


  // ---------点击跳转至详情页面-------------
  tapToDetail: function(e) {
    wx.navigateTo({
      url: '../detail/detail?_id=' + e.currentTarget.dataset.fid,
    })
  },


  // ------------生命周期函数------------
  onLoad: function (options) {
    var that = this
    wx.showLoading({
      title: '生活要领鲜',
    })
    that.setData({
      isShow: false
    })
    // 获取openId
    this.getOpenid();
  },

  onReady: function () {
    // console.log(getCurrentPages()["0"].data)
  },

  onShow: function () {
    var that = this
    // 首页默认显示“美味鲜果”并分页加载
    this.setData({ activeTypeId: 0 })
    this.resetPagination()
    this.loadProductsPage()
    // console.log(app.globalData.offLine)
    // 是否下线
    app.getInfoWhere('setting', { "option": "offLine" },
      e => {
        that.setData({
          offLine: e.data["0"].offLine
        })
      }
    )
  },

  onHide: function () {

  },

  onUnload: function () {

  },

  onPullDownRefresh: function () {

  },

  onReachBottom: function () {
    // 触底加载下一页
    this.loadProductsPage()
  },

  onShareAppMessage: function () {
    return {
      title: '校园自有平台-物美价廉',
      imageUrl: '../../images/icon/fruit.jpg',
      path: '/pages/homepage/homepage'
    }
  }

})