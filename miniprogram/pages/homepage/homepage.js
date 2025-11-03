// miniprogram/pages/homepage/homepage.js


const app = getApp()

Page({
  data: {
    swiperImgNo: 1,
    imgSwiperUrl: '',
    fruitInfo: [],
    typeCat: [
      { id: 0, name: "美味鲜果" },
      { id: 1, name: "精品盒饭" },
      { id: 2, name: "新鲜上架" },
      { id: 3, name: "店主推荐" },
    ],
    activeTypeId: 0,
    isShow:true, 
    openid: '',   
    offLine:null  //是否维护
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

  // 模拟下单功能
  mockOrder() {
    const that = this;
    
    // 显示加载提示
    wx.showLoading({
      title: '正在生成模拟订单...',
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

    // 随机选择2-4种商品
    const selectedFruits = [];
    const fruitCount = Math.floor(Math.random() * 3) + 2; // 2-4种商品
    const usedIndices = new Set();
    
    let totalAmount = 0;
    for (let i = 0; i < fruitCount; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * realFruits.length);
      } while (usedIndices.has(randomIndex));
      
      usedIndices.add(randomIndex);
      const fruit = realFruits[randomIndex];
      const [name, quantity, price, unit, imgUrl] = fruit;
      
      // 随机调整数量，使订单更真实
      const adjustedQuantity = Math.round((Math.random() * 2 + 0.5) * quantity * 10) / 10; // 0.5-2.5倍的随机数量
      
      selectedFruits.push([name, adjustedQuantity, price]);
      totalAmount += adjustedQuantity * price;
    }

    // 生成真实的订单号（格式：FS + 年月日 + 时分秒 + 3位随机数）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const orderNumber = `FS${year}${month}${day}${hour}${minute}${second}${random}`;

    // 随机生成不同的订单场景
    const scenarios = [
      // 场景1：正常订单（80%概率）
      {
        weight: 80,
        config: {
          paySuccess: true,
          sending: false,
          finished: false,
          printed: false,
          scenario: '正常待发货订单'
        }
      },
      // 场景2：大额订单（10%概率）
      {
        weight: 10,
        config: {
          paySuccess: true,
          sending: false,
          finished: false,
          printed: false,
          scenario: '大额订单',
          multiplier: 2.5 // 金额倍数
        }
      },
      // 场景3：紧急订单（5%概率）
      {
        weight: 5,
        config: {
          paySuccess: true,
          sending: false,
          finished: false,
          printed: false,
          scenario: '紧急订单',
          message: '紧急订单！请优先配送，谢谢！'
        }
      },
      // 场景4：VIP客户订单（3%概率）
      {
        weight: 3,
        config: {
          paySuccess: true,
          sending: false,
          finished: false,
          printed: false,
          scenario: 'VIP客户订单',
          name: 'VIP-' + randomUser.name,
          message: 'VIP客户，请确保水果新鲜度'
        }
      },
      // 场景5：团购订单（2%概率）
      {
        weight: 2,
        config: {
          paySuccess: true,
          sending: false,
          finished: false,
          printed: false,
          scenario: '团购订单',
          multiplier: 3.0,
          message: '团购订单，请按时配送到指定地点'
        }
      }
    ];

    // 根据权重随机选择场景
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    let selectedScenario = scenarios[0]; // 默认场景

    for (const scenario of scenarios) {
      randomWeight -= scenario.weight;
      if (randomWeight <= 0) {
        selectedScenario = scenario;
        break;
      }
    }

    // 应用场景配置
    const scenarioConfig = selectedScenario.config;
    if (scenarioConfig.multiplier) {
      totalAmount *= scenarioConfig.multiplier;
      // 调整商品数量以匹配金额
      selectedFruits.forEach(fruit => {
        fruit[1] = Math.round(fruit[1] * scenarioConfig.multiplier * 10) / 10;
      });
    }

    // 生成模拟订单数据
    const mockOrderData = {
      name: scenarioConfig.name || randomUser.name,
      phone: randomUser.phone,
      schoolName: randomAddress.schoolName,
      addressItem: randomAddress.addressItem,
      detail: randomAddress.detail,
      message: scenarioConfig.message || randomMessage,
      orderTime: app.CurrentTime_show(),
      orderSuccess: true,
      payTime: app.CurrentTime_show(),
      paySuccess: scenarioConfig.paySuccess,
      sending: scenarioConfig.sending,
      finished: scenarioConfig.finished,
      printed: scenarioConfig.printed,
      fruitList: selectedFruits,
      total: Math.round(totalAmount * 100) / 100, // 保留两位小数
      openid: that.data.openid || 'mock_openid_' + Date.now(),
      out_trade_no: 'MOCK_' + Date.now(),
      orderNumber: orderNumber,
      scenario: scenarioConfig.scenario // 添加场景标识
    };

    console.log('生成的模拟订单数据:', mockOrderData);

    // 将订单数据插入数据库
    app.addRowToSet('order_master', mockOrderData, (res) => {
      wx.hideLoading();
      console.log('模拟订单插入结果:', res);
      
      if (res) {
        wx.showModal({
          title: '模拟下单成功！',
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
    switch (e.currentTarget.id) {
      // 全部展示
      case '0':
        app.getInfoByOrder('fruit-board', 'time', 'desc',
          e => {
            getCurrentPages()["0"].setData({
              fruitInfo: e.data
            })
          }
        )
        break;
      // 精品盒饭
      case '1':
        app.getInfoWhere('fruit-board', {myClass:1},
          e => {
            getCurrentPages()["0"].setData({
              fruitInfo: e.data
            })
          }
        )
        break;
      // 销量排行
      case '2':
        app.getInfoByOrder('fruit-board','time','desc',
          e => {
            getCurrentPages()["0"].setData({
              fruitInfo: e.data
            })
          }
        )
        break;
      // 店主推荐
      case '3':
        app.getInfoWhere('fruit-board', { recommend: '1' },
          e => {
            getCurrentPages()["0"].setData({
              fruitInfo: e.data
            })
          }
        )
        break;
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
    // 水果信息
    // app.getInfoFromSet('fruit-board', {},
    //   e => {
    //     // console.log(e.data)
    //     getCurrentPages()["0"].setData({
    //       fruitInfo: e.data,
    //       isShow: true
    //     })
    //     wx.hideLoading()
    //   }
    // )
    app.getInfoByOrder('fruit-board', 'time', 'desc',
      e => {
        getCurrentPages()["0"].setData({
          fruitInfo: e.data,
          isShow: true
        })
        wx.hideLoading()
      }
    )
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

  },

  onShareAppMessage: function () {
    return {
      title: '水果园byVoyz',
      imageUrl: '../../images/icon/fruit.jpg',
      path: '/pages/homepage/homepage'
    }
  }

})