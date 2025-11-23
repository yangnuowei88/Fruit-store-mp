const app = getApp()
// 引入GBK编码模块，解决蓝牙打印中文乱码问题
const gbkEncoder = require('../../utils/gbkEncoder.js')
const dateUtils = require('../../utils/dateUtils.js')

Page({
  data: {
    orderList: [],
    sendingList: [],
    finishedList: [],
    allOrderList: [], // 存储所有订单的完整列表
    displayOrderList: [], // 用于显示的订单列表（原始数据或搜索结果）
    cardNum: 1,
    // 分页状态
    page: 0,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    // 搜索相关
    searchPhone: '',
    searchResult: [],
    showNoResult: false,
    // 双打印机管理
    fruitPrinter: {
      enabled: false,
      devices: [],
      connectedDevice: null,
      isConnecting: false,
      characteristic: null
    },
    boxlunchPrinter: {
      enabled: false,
      devices: [],
      connectedDevice: null,
      isConnecting: false,
      characteristic: null
    },
    // 新增弹窗状态
    showPrinterTypeModal: false,      // 打印机类型选择弹窗
    showPrinterDeviceModal: false,    // 打印机设备选择弹窗
    selectedPrinterType: '',          // 当前选择的打印机类型 'fruit' 或 'boxlunch'
    availableDevices: [],             // 搜索到的可用设备列表
    searchingDevices: false,          // 是否正在搜索设备
    // 蓝牙打印机相关（保持兼容性）
    bluetoothEnabled: false,
    bluetoothDevices: [],
    connectedDevice: null,
    isConnecting: false,
    showBluetoothModal: false,
    // 新订单提醒相关
    lastOrderCount: 0,
    orderCheckInterval: null,
    // 自动发货相关
    autoShippingEnabled: true,  // 是否启用自动发货
    autoShippingInterval: null, // 自动发货检查定时器
    autoPrintEnabled: true,     // 是否启用自动打印
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('🚀 ===== bgManage页面加载 =====')
    // 初始化正在打印的订单ID集合
    this.printingOrders = new Set()
    // 初始化蓝牙监听器回调引用（用于后续移除）
    this.bluetoothStateChangeHandler = null
    // 默认加载当前标签页的第一页数据（替代原有一次性全量查询）
    this.resetOrderPagination()
    this.loadOrderPage()
    this.initBluetooth()
    // 检查真实打印机连接状态
    this.checkDualPrinterStatus()
    this.startOrderMonitoring()
    console.log('✅ bgManage页面加载完成')
  },

  // --------------------!!!  选项卡切换  !!!----------------------
  tapTo1: function () {  //添加
    var that = this
    that.setData({
      cardNum: 1
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
    // 更新显示列表
    this.resetOrderPagination()
    this.loadOrderPage()
  },
  tapTo2: function () { //修改和删除
    var that = this
    that.setData({
      cardNum: 2
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
    // 更新显示列表
    this.resetOrderPagination()
    this.loadOrderPage()
    // console.log(getCurrentPages())
  },
  tapTo3: function () {
    var that = this
    that.setData({
      cardNum: 3
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
    // 更新显示列表
    this.resetOrderPagination()
    this.loadOrderPage()
  },
  tapTo4: function () {
    var that = this
    that.setData({
      cardNum: 4
    })
    // 在所有订单标签页，重置并加载分页
    this.clearSearchState()
    this.resetOrderPagination()
    this.loadOrderPage()
  },

  // 更新显示列表（根据是否有搜索结果）
  updateDisplayList: function() {
    if (this.data.searchResult.length > 0) {
      // 如果有搜索结果，显示搜索结果
      this.setData({
        displayOrderList: this.data.searchResult
      })
    } else {
      // 根据当前标签页选择数据源
      let dataSource;
      switch (this.data.cardNum) {
        case 1: // 已支付（待发货）
          dataSource = this.data.orderList;
          break;
        case 2: // 已发货
          dataSource = this.data.sendingList;
          break;
        case 3: // 已送达
          dataSource = this.data.finishedList;
          break;
        case 4: // 所有订单
          dataSource = this.data.allOrderList;
          break;
        default:
          dataSource = this.data.orderList;
      }
      
      this.setData({
        displayOrderList: dataSource
      })
    }
  },

  // 清空搜索状态（用于切换标签页时）
  clearSearchState: function() {
    this.setData({
      searchPhone: '',
      searchResult: [],
      displayOrderList: [],
      showNoResult: false
    })
  },

  // 分页：重置当前标签页分页状态
  resetOrderPagination: function() {
    this.setData({
      page: 0,
      hasMore: true,
      loadingMore: false
    })
    // 清空当前标签页对应的列表
    switch (this.data.cardNum) {
      case 1:
        this.setData({ orderList: [], displayOrderList: [] })
        break
      case 2:
        this.setData({ sendingList: [], displayOrderList: [] })
        break
      case 3:
        this.setData({ finishedList: [], displayOrderList: [] })
        break
      case 4:
        this.setData({ allOrderList: [], displayOrderList: [] })
        break
      default:
        this.setData({ orderList: [], displayOrderList: [] })
    }
  },

  // 分页：加载当前标签页的一页数据
  loadOrderPage: function() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })

    const page = this.data.page
    const pageSize = this.data.pageSize
    const card = this.data.cardNum

    const appendAndUpdate = (listName, rows) => {
      const oldList = this.data[listName] || []
      const newList = oldList.concat(rows || [])
      const hasMore = (rows || []).length >= pageSize
      const nextPage = hasMore ? page + 1 : page

      this.setData({
        [listName]: newList,
        displayOrderList: this.data.searchResult.length > 0 ? this.data.searchResult : newList,
        page: nextPage,
        hasMore: hasMore,
        loadingMore: false
      })
    }

    // 根据标签页选择不同查询条件
    if (card === 1) {
      // 待发货：已支付、未发货、未完成
      app.getInfoWhereAndOrderPaged(
        'order_master',
        { paySuccess: true, sending: false, finished: false },
        'orderTime', 'desc',
        page, pageSize,
        e => appendAndUpdate('orderList', e.data)
      )
    } else if (card === 2) {
      // 配送中：已发货、未完成
      app.getInfoWhereAndOrderPaged(
        'order_master',
        { sending: true, finished: false },
        'orderTime', 'desc',
        page, pageSize,
        e => appendAndUpdate('sendingList', e.data)
      )
    } else if (card === 3) {
      // 已完成
      app.getInfoWhereAndOrderPaged(
        'order_master',
        { finished: true },
        'orderTime', 'desc',
        page, pageSize,
        e => appendAndUpdate('finishedList', e.data)
      )
    } else {
      // 所有订单
      app.getInfoByOrderPaged(
        'order_master', 'orderTime', 'desc',
        page, pageSize,
        e => appendAndUpdate('allOrderList', e.data)
      )
    }
  },

  // 刷新当前标签页（用于更新状态后重新拉第一页）
  refreshCurrentTab: function() {
    this.resetOrderPagination()
    this.loadOrderPage()
  },

  // ----------------------!!!  搜索功能  !!!----------------------
  // 搜索输入框输入事件
  onSearchInput: function(e) {
    this.setData({
      searchPhone: e.detail.value,
      showNoResult: false
    })
  },

  // 根据手机号后四位搜索订单
  searchOrderByPhone: function() {
    const searchPhone = this.data.searchPhone.trim()
    
    if (!searchPhone) {
      wx.showToast({
        title: '请输入手机号后四位',
        icon: 'none'
      })
      return
    }

    // 验证输入格式（4位数字）
    if (!/^\d{4}$/.test(searchPhone)) {
      wx.showToast({
        title: '请输入4位数字',
        icon: 'none'
      })
      return
    }

    // 在订单列表中搜索匹配的手机号后四位
    const searchResult = this.data.orderList.filter(order => {
      return order.phone && order.phone.endsWith(searchPhone)
    })

    this.setData({
      searchResult: searchResult,
      displayOrderList: searchResult,
      showNoResult: searchResult.length === 0
    })

    if (searchResult.length === 0) {
      wx.showToast({
        title: '未找到相关订单',
        icon: 'none'
      })
    } else {
      wx.showToast({
        title: `找到${searchResult.length}条订单`,
        icon: 'success'
      })
    }
  },

  // 清空搜索
  clearSearch: function() {
    this.setData({
      searchPhone: '',
      searchResult: [],
      displayOrderList: this.data.orderList,
      showNoResult: false
    })
    wx.showToast({
      title: '已清空搜索',
      icon: 'success'
    })
  },

  // ----------------------!!!  订单管理  !!!----------------------
  // 已支付-发货
  boxFruit: function(e) {
    console.log('boxFruit函数被调用了！');
    console.log('事件对象:', e);
    
    var that = this
    const orderId = e.currentTarget.id;
    console.log('点击发货，订单ID:', orderId);
    console.log('当前orderList:', that.data.orderList);
    
    // 如果没有订单ID，直接返回
    if (!orderId) {
      console.error('没有获取到订单ID');
      wx.showToast({
        title: '获取订单信息失败',
        icon: 'none'
      });
      return;
    }
    
    // 确保orderList是数组
    const orderList = Array.isArray(that.data.orderList) ? that.data.orderList : [];
    const orderData = orderList.find(order => order._id === orderId);
    
    if (!orderData) {
      console.error('未找到订单数据');
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }
    
    console.log('找到的订单数据:', orderData);
    
    // 检查订单是否已经打印过
    if (orderData.printed === true) {
      console.log('订单已打印过，直接发货');
      wx.showModal({
        title: '发货确认',
        content: '此订单已打印过，是否直接发货？',
        confirmText: '确认发货',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            that.updateOrderToShipping(orderId);
          }
        }
      });
      return;
    }
    
    // 先显示一个toast确认代码执行到这里
    wx.showToast({
      title: '找到订单，准备发货',
      icon: 'success',
      duration: 1000
    });
    
    // 延迟一下再显示弹窗，避免冲突
    setTimeout(() => {
      // 询问是否打印订单
      console.log('准备显示弹窗...');
      wx.showModal({
        title: '发货确认',
        content: '是否需要打印订单？',
        confirmText: '打印发货',
        cancelText: '直接发货',
        success: (res) => {
          console.log('弹窗回调成功，用户选择:', res);
          if (res.confirm && orderData) {
            // 打印订单 - 使用智能打印方式
            console.log('用户选择打印订单');
            that.smartPrintOrder(orderData);
          } else {
            // 禁止未打印的直接发货
            console.log('未打印订单禁止直接发货');
            wx.showToast({
              title: '请先打印再发货',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('弹窗显示失败:', err);
        }
      });
    }, 1200); // 等待toast显示完毕后再显示弹窗
  },

  // 已发货-送达
  sendingFruit: function(e) {
    var that = this
    const orderId = e.currentTarget.id
    console.log(orderId)

    // 校验：只有 printed===true 才允许发货
    const lists = [
      that.data.orderList || [],
      that.data.displayOrderList || [],
      that.data.allOrderList || []
    ]
    const localOrder = lists.reduce((found, list) => found || list.find(o => o._id === orderId), null)
    const localPrinted = localOrder ? localOrder.printed === true : null

    if (localPrinted === false) {
      wx.showToast({ title: '请先打印再发货', icon: 'none' })
      return
    }

    if (localPrinted === null) {
      const db = wx.cloud.database()
      db.collection('order_master').doc(orderId).get().then(res => {
        const doc = res && res.data
        if (!doc || doc.printed !== true) {
          wx.showToast({ title: '请先打印再发货', icon: 'none' })
          return
        }
        // 已确认打印，继续发货更新
        wx.showLoading({ title: '发货中...' })
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: {
            orderId,
            updates: {
              sending: true,
              sendingTime: app.CurrentTime_show()
            }
          }
        }).then(res2 => {
          wx.hideLoading()
          if (res2 && res2.result && res2.result.success && res2.result.stats && res2.result.stats.updated > 0) {
            that.refreshCurrentTab()
            wx.showToast({ title: '【已发货】' })
          } else {
            wx.showToast({ title: '云函数更新失败或无变化', icon: 'none' })
            console.warn('发货状态更新失败或无变化:', res2)
          }
        }).catch(err2 => {
          wx.hideLoading()
          wx.showToast({ title: '发货失败', icon: 'none' })
          console.error('云函数更新发货状态异常:', err2)
        })
      }).catch(err => {
        wx.showToast({ title: '获取订单状态失败，请重试', icon: 'none' })
        console.error('获取订单打印状态失败:', err)
      })
      return
    }

    // 本地已确认 printed===true，直接发货
    wx.showLoading({ title: '发货中...' })
    wx.cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId,
        updates: {
          sending: true,
          sendingTime: app.CurrentTime_show()
        }
      }
    }).then(res => {
      wx.hideLoading()
      if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
        that.refreshCurrentTab()
        wx.showToast({ title: '【已发货】' })
      } else {
        wx.showToast({ title: '云函数更新失败或无变化', icon: 'none' })
        console.warn('发货状态更新失败或无变化:', res)
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '发货失败', icon: 'none' })
      console.error('云函数更新发货状态异常:', err)
    })
  },

  // 确认送达
  confirmDelivery: function(e) {
    var that = this
    console.log('确认送达订单ID:', e.currentTarget.id)
    wx.showLoading({ title: '提交中...' })
    wx.cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId: e.currentTarget.id,
        updates: {
          finished: true,
          finishedTime: app.CurrentTime_show()
        }
      }
    }).then(res => {
      wx.hideLoading()
      if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
        that.refreshCurrentTab()
        wx.showToast({ title: '【已送达】' })
      } else {
        wx.showToast({ title: '云函数更新失败或无变化', icon: 'none' })
        console.warn('送达状态更新失败或无变化:', res)
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '送达更新失败', icon: 'none' })
      console.error('云函数更新送达状态异常:', err)
    })
  },

  // 跳转到调试页面
  goToDebug: function() {
    wx.navigateTo({
      url: './debug'
    })
  },

  // ----------------------!!!  蓝牙打印机功能  !!!----------------------
  // 初始化蓝牙
  initBluetooth() {
    const that = this;
    wx.openBluetoothAdapter({
      success: function(res) {
        console.log('蓝牙初始化成功', res);
        that.setData({
          bluetoothEnabled: true
        });
        
        // 添加蓝牙连接状态监听器
        that.setupBluetoothConnectionListener();
      },
      fail: function(err) {
        console.log('蓝牙初始化失败', err);
        if (err.errCode === 10001) {
          wx.showModal({
            title: '提示',
            content: '请先开启手机蓝牙功能',
            showCancel: false
          });
        }
      }
    });
  },

  // 设置蓝牙连接状态监听器
  setupBluetoothConnectionListener() {
    const that = this;
    
    // 如果已经设置过监听器，先移除旧的
    if (that.bluetoothStateChangeHandler) {
      console.log('🔄 移除旧的蓝牙状态监听器');
      wx.offBLEConnectionStateChange(that.bluetoothStateChangeHandler);
    }
    
    // 定义监听器回调函数
    that.bluetoothStateChangeHandler = function(res) {
      console.log('🔌 蓝牙连接状态变化:', res);
      
      // 检查是否是我们连接的设备
      const fruitDevice = that.data.fruitPrinter.connectedDevice;
      const boxlunchDevice = that.data.boxlunchPrinter.connectedDevice;
      
      if (fruitDevice && fruitDevice.deviceId === res.deviceId) {
        if (!res.connected) {
          console.log('🍎 水果打印机意外断开连接');
          that.handlePrinterDisconnected('fruit');
        } else {
          console.log('🍎 水果打印机已连接');
        }
      }
      
      if (boxlunchDevice && boxlunchDevice.deviceId === res.deviceId) {
        if (!res.connected) {
          console.log('🍱 盒饭打印机意外断开连接');
          that.handlePrinterDisconnected('boxlunch');
        } else {
          console.log('🍱 盒饭打印机已连接');
        }
      }
    };
    
    // 注册监听器
    wx.onBLEConnectionStateChange(that.bluetoothStateChangeHandler);
    console.log('✅ 蓝牙连接状态监听器已设置');
  },

  // 处理打印机意外断开连接
  handlePrinterDisconnected(type) {
    const that = this;
    const printerName = type === 'fruit' ? '水果打印机' : '盒饭打印机';
    
    // 清除连接状态
    that.clearPrinterConnection(type);
    
    // 提示用户
    wx.showToast({
      title: `${printerName}连接已断开`,
      icon: 'none',
      duration: 2000
    });
  },

  // 搜索蓝牙设备
  searchBluetoothDevices() {
    const that = this;
    if (!this.data.bluetoothEnabled) {
      wx.showToast({
        title: '请先开启蓝牙',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '搜索设备中...'
    });

    wx.startBluetoothDevicesDiscovery({
      success: function(res) {
        console.log('开始搜索设备', res);
        
        // 监听设备发现
        wx.onBluetoothDeviceFound(function(devices) {
          console.log('发现设备', devices);
          const newDevices = devices.devices.filter(device => 
            device.name && (device.name.includes('打印') || device.name.includes('Print') || device.name.includes('POS'))
          );
          
          if (newDevices.length > 0) {
            that.setData({
              bluetoothDevices: [...that.data.bluetoothDevices, ...newDevices]
            });
          }
        });

        // 3秒后停止搜索
        setTimeout(() => {
          wx.stopBluetoothDevicesDiscovery();
          wx.hideLoading();
          that.setData({
            showBluetoothModal: true
          });
        }, 3000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.log('搜索设备失败', err);
        wx.showToast({
          title: '搜索失败',
          icon: 'none'
        });
      }
    });
  },

  // 连接蓝牙设备
  connectBluetoothDevice(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const that = this;
    that.setData({
      isConnecting: true
    });

    wx.createBLEConnection({
      deviceId: deviceId,
      success: function(res) {
        console.log('连接成功', res);
        const device = that.data.bluetoothDevices.find(d => d.deviceId === deviceId);
        
        // 如果选择了打印机类型，则连接到对应的打印机
        if (that.data.selectedPrinterType) {
          const type = that.data.selectedPrinterType;
          that.connectPrinterByType(type, device);
        } else {
          // 否则使用原始的连接逻辑
          that.setData({
            connectedDevice: device,
            isConnecting: false,
            showBluetoothModal: false
          });
          
          wx.showToast({
            title: '连接成功',
            icon: 'success'
          });

          // 获取服务和特征值
          that.getBLEDeviceServices(deviceId);
        }
      },
      fail: function(err) {
        console.log('连接失败', err);
        that.setData({
          isConnecting: false
        });
        wx.showToast({
          title: '连接失败',
          icon: 'none'
        });
      }
    });
  },

  // 获取蓝牙设备服务
  getBLEDeviceServices(deviceId) {
    const that = this;
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: function(res) {
        console.log('获取服务成功', res.services);
        // 通常打印机使用的服务UUID
        const printService = res.services.find(service => 
          service.uuid.includes('18F0') || service.uuid.includes('E7810A71')
        );
        
        if (printService) {
          that.getBLEDeviceCharacteristics(deviceId, printService.uuid);
        }
      }
    });
  },

  // 获取特征值
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId: deviceId,
      serviceId: serviceId,
      success: function(res) {
        console.log('获取特征值成功', res.characteristics);
        // 保存写入特征值
        const writeCharacteristic = res.characteristics.find(char => 
          char.properties.write || char.properties.writeNoResponse
        );
        
        if (writeCharacteristic) {
          // 保存特征值信息用于后续打印
          wx.setStorageSync('printerCharacteristic', {
            deviceId: deviceId,
            serviceId: serviceId,
            characteristicId: writeCharacteristic.uuid
          });
        }
      }
    });
  },

  // 断开蓝牙连接
  disconnectBluetooth() {
    const that = this;
    if (that.data.connectedDevice) {
      wx.closeBLEConnection({
        deviceId: that.data.connectedDevice.deviceId,
        success: function() {
          that.setData({
            connectedDevice: null
          });
          wx.removeStorageSync('printerCharacteristic');
          wx.showToast({
            title: '已断开连接',
            icon: 'success'
          });
        }
      });
    }
  },

  // 断开当前连接的打印机
  disconnectCurrentPrinter() {
    const that = this;
    
    // 检查哪个打印机已连接并断开
    if (that.data.fruitPrinter.connectedDevice) {
      that.disconnectPrinterByType('fruit');
    } else if (that.data.boxlunchPrinter.connectedDevice) {
      that.disconnectPrinterByType('boxlunch');
    } else {
      wx.showToast({
        title: '没有连接的打印机',
        icon: 'none'
      });
    }
  },

  // 断开水果打印机连接
  disconnectFruitPrinter() {
    const that = this;
    const fruitDevice = that.data.fruitPrinter.connectedDevice;
    if (fruitDevice) {
      wx.closeBLEConnection({
        deviceId: fruitDevice.deviceId,
        success: function() {
          that.setData({
            'fruitPrinter.connectedDevice': null
          });
          // 清除本地存储中的水果打印机信息
          wx.removeStorageSync('fruitPrinterCharacteristic');
          wx.showToast({
            title: '水果打印机已断开',
            icon: 'success'
          });
          console.log('🍎 水果打印机已断开连接');
        },
        fail: function(err) {
          console.error('🍎 断开水果打印机失败:', err);
          wx.showToast({
            title: '断开失败',
            icon: 'error'
          });
        }
      });
    }
  },

  // 断开盒饭打印机连接
  disconnectBoxlunchPrinter() {
    const that = this;
    const boxlunchDevice = that.data.boxlunchPrinter.connectedDevice;
    if (boxlunchDevice) {
      wx.closeBLEConnection({
        deviceId: boxlunchDevice.deviceId,
        success: function() {
          that.setData({
            'boxlunchPrinter.connectedDevice': null
          });
          // 清除本地存储中的盒饭打印机信息
          wx.removeStorageSync('boxlunchPrinterCharacteristic');
          wx.showToast({
            title: '盒饭打印机已断开',
            icon: 'success'
          });
          console.log('🍱 盒饭打印机已断开连接');
        },
        fail: function(err) {
          console.error('🍱 断开盒饭打印机失败:', err);
          wx.showToast({
            title: '断开失败',
            icon: 'error'
          });
        }
      });
    }
  },

  // 连接模拟打印机
  

  // 断开模拟打印机
  

  // 双打印机管理函数
  // 显示打印机类型选择弹窗
  showPrinterTypeModal() {
    // 先初始化蓝牙适配器
    const that = this;
    wx.openBluetoothAdapter({
      success: function(res) {
        console.log('蓝牙适配器初始化成功');
        that.setData({
          showPrinterTypeModal: true,
          'fruitPrinter.enabled': true,
          'boxlunchPrinter.enabled': true
        });
      },
      fail: function(err) {
        console.error('蓝牙适配器初始化失败:', err);
        wx.showToast({
          title: '请开启蓝牙',
          icon: 'none'
        });
      }
    });
  },

  // 关闭打印机类型选择弹窗
  closePrinterTypeModal() {
    this.setData({
      showPrinterTypeModal: false
    });
  },

  // 选择打印机类型
  selectPrinterType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedPrinterType: type,
      showPrinterTypeModal: false
    });
    
    // 始终使用分类打印机逻辑
    this.setData({
      showPrinterDeviceModal: true,
      searchingDevices: true,
      availableDevices: []
    });
    // 开始搜索设备
    this.searchDevicesForType();
  },

  // 关闭打印机设备选择弹窗
  closePrinterDeviceModal() {
    this.setData({
      showPrinterDeviceModal: false,
      selectedPrinterType: '',
      availableDevices: [],
      searchingDevices: false
    });
    // 停止搜索
    wx.stopBluetoothDevicesDiscovery({});
  },

  // 为指定类型搜索设备
  searchDevicesForType() {
    const that = this;
    
    that.setData({
      searchingDevices: true,
      availableDevices: []
    });

    wx.startBluetoothDevicesDiscovery({
      success: function(res) {
        console.log('开始搜索蓝牙设备');
        
        // 3秒后获取搜索结果
        setTimeout(() => {
          wx.getBluetoothDevices({
            success: function(res) {
              const devices = res.devices.filter(device => 
                device.name && 
                device.name.length > 0 && 
                device.RSSI > -80 // 过滤信号较弱的设备
              );
              
              that.setData({
                availableDevices: devices,
                searchingDevices: false
              });
              
              if (devices.length === 0) {
                wx.showToast({
                  title: '未发现设备',
                  icon: 'none'
                });
              }
            },
            fail: function(err) {
              console.error('获取蓝牙设备失败:', err);
              that.setData({
                searchingDevices: false
              });
            }
          });
        }, 3000);
      },
      fail: function(err) {
        console.error('搜索蓝牙设备失败:', err);
        that.setData({
          searchingDevices: false
        });
        wx.showToast({
          title: '搜索失败',
          icon: 'none'
        });
      }
    });
  },

  // 连接选中的打印机
  connectSelectedPrinter(e) {
    const device = e.currentTarget.dataset.device;
    const type = this.data.selectedPrinterType;
    
    if (!type || !device) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    // 关闭弹窗
    this.setData({
      showPrinterDeviceModal: false
    });

    // 连接打印机
    this.connectPrinterByType(type, device);
  },

  // 通用打印机连接函数
  connectPrinterByType(type, device) {
    const that = this;
    const printerKey = type + 'Printer';
    
    that.setData({
      [`${printerKey}.isConnecting`]: true
    });

    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: function(res) {
        console.log(`${type}打印机连接成功:`, res);
        that.getPrinterServices(type, device);
      },
      fail: function(err) {
        console.error(`${type}打印机连接失败:`, err);
        that.setData({
          [`${printerKey}.isConnecting`]: false
        });
        wx.showToast({
          title: '连接失败',
          icon: 'none'
        });
      }
    });
  },

  // 获取打印机服务
  getPrinterServices(type, device) {
    const that = this;
    const printerKey = type + 'Printer';
    
    wx.getBLEDeviceServices({
      deviceId: device.deviceId,
      success: function(res) {
        console.log(`${type}打印机服务:`, res.services);
        const serviceId = res.services[0].uuid;
        that.getPrinterCharacteristics(type, device, serviceId);
      },
      fail: function(err) {
        console.error(`获取${type}打印机服务失败:`, err);
        that.setData({
          [`${printerKey}.isConnecting`]: false
        });
      }
    });
  },

  // 获取打印机特征值
  getPrinterCharacteristics(type, device, serviceId) {
    const that = this;
    const printerKey = type + 'Printer';
    
    wx.getBLEDeviceCharacteristics({
      deviceId: device.deviceId,
      serviceId: serviceId,
      success: function(res) {
        console.log(`${type}打印机特征值:`, res.characteristics);
        const writeCharacteristic = res.characteristics.find(char => char.properties.write);
        
        if (writeCharacteristic) {
          const characteristic = {
            deviceId: device.deviceId,
            serviceId: serviceId,
            characteristicId: writeCharacteristic.uuid
          };
          
          that.setData({
            [`${printerKey}.connectedDevice`]: {
              deviceId: device.deviceId,
              name: device.name || `${type === 'fruit' ? '水果' : '盒饭'}打印机`
            },
            [`${printerKey}.characteristic`]: characteristic,
            [`${printerKey}.isConnecting`]: false
          });

          // 保存到本地存储
          wx.setStorageSync(`${type}PrinterCharacteristic`, characteristic);
          wx.setStorageSync(`${type}PrinterDevice`, {
            deviceId: device.deviceId,
            name: device.name || `${type === 'fruit' ? '水果' : '盒饭'}打印机`
          });
          
          wx.showToast({
            title: `${type === 'fruit' ? '水果' : '盒饭'}打印机已连接`,
            icon: 'success'
          });
        }
      },
      fail: function(err) {
        console.error(`获取${type}打印机特征值失败:`, err);
        that.setData({
          [`${printerKey}.isConnecting`]: false
        });
      }
    });
  },

  // 断开所有打印机连接
  disconnectAllPrinters() {
    const that = this;
    
    wx.showModal({
      title: '确认断开',
      content: '确定要断开所有打印机连接吗？',
      success: function(res) {
        if (res.confirm) {
          // 断开水果打印机
          if (that.data.fruitPrinter.connectedDevice) {
            that.disconnectPrinterByType('fruit');
          }
          
          // 断开盒饭打印机
          if (that.data.boxlunchPrinter.connectedDevice) {
            that.disconnectPrinterByType('boxlunch');
          }
        }
      }
    });
  },

  // 断开指定类型打印机
  disconnectPrinterByType(type) {
    const that = this;
    const printerKey = type + 'Printer';
    const connectedDevice = that.data[printerKey].connectedDevice;
    const printerName = type === 'fruit' ? '水果打印机' : '盒饭打印机';
    
    if (!connectedDevice) {
      wx.showToast({
        title: `${printerName}未连接`,
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '断开连接中...'
    });

    wx.closeBLEConnection({
      deviceId: connectedDevice.deviceId,
      success: function() {
        console.log(`${printerName}断开连接成功`);
        that.clearPrinterConnection(type);
        wx.hideLoading();
        wx.showToast({
          title: `${printerName}已断开`,
          icon: 'success'
        });
      },
      fail: function(err) {
        console.error(`断开${printerName}失败:`, err);
        wx.hideLoading();
        
        // 检查错误类型
        if (err.errCode === 10012 || err.errMsg.includes('not connected')) {
          // 设备已经断开，只是状态没有同步
          that.clearPrinterConnection(type);
          wx.showToast({
            title: `${printerName}已断开`,
            icon: 'success'
          });
        } else {
          // 真正的断开失败
          wx.showToast({
            title: '断开连接失败，请重试',
            icon: 'error'
          });
        }
      }
    });
  },

  // 清除打印机连接状态（提取为独立函数）
  clearPrinterConnection(type) {
    const printerKey = type + 'Printer';
    
    this.setData({
      [`${printerKey}.connectedDevice`]: null,
      [`${printerKey}.characteristic`]: null,
      [`${printerKey}.isConnecting`]: false
    });
    
    // 清除本地存储
    wx.removeStorageSync(`${type}PrinterCharacteristic`);
    wx.removeStorageSync(`${type}PrinterDevice`);
  },

  // 检测订单类型
  detectOrderType(orderData) {
    const fruitItems = [];
    const boxlunchItems = [];
    
    if (orderData.fruitList && Array.isArray(orderData.fruitList)) {
      console.log(`🔎[打印调试] 订单 ${orderData._id} 商品列表长度:`, orderData.fruitList.length);
      orderData.fruitList.forEach(item => {
        // item格式: [商品名, 数量, 价格, 类型]
        const rawType = item[3];
        const typeNum = Number(rawType);
        console.log(`🔎[打印调试] 订单 ${orderData._id} 商品类型字段:`, {
          name: item[0], rawType,
          rawTypeType: typeof rawType,
          parsedNumber: typeNum,
          usedType: (rawType === 0 || rawType === 1) ? rawType : (Number.isFinite(typeNum) ? typeNum : 0)
        });
        const productType = (rawType === 0 || rawType === 1)
          ? rawType
          : (Number.isFinite(typeNum) ? typeNum : 0); // 默认为水果，兼容字符串"0"/"1"
        if (productType === 0) {
          fruitItems.push(item);
        } else if (productType === 1) {
          boxlunchItems.push(item);
        }
      });
    }

    // 判断订单类型
    const hasFruit = fruitItems.length > 0;
    const hasBoxlunch = boxlunchItems.length > 0;
    console.log(`🔎[打印调试] 订单 ${orderData._id} 分组结果:`, {
      fruitCount: fruitItems.length,
      boxlunchCount: boxlunchItems.length
    });
    
    if (hasFruit && hasBoxlunch) {
      return { type: 'mixed', fruitItems, boxlunchItems }; // 混合订单
    } else if (hasFruit && !hasBoxlunch) {
      return { type: 'fruit', fruitItems, boxlunchItems }; // 纯水果订单
    } else if (!hasFruit && hasBoxlunch) {
      return { type: 'boxlunch', fruitItems, boxlunchItems }; // 纯盒饭订单
    } else {
      return { type: 'empty', fruitItems, boxlunchItems }; // 空订单
    }
  },

  // 智能打印订单 - 根据订单类型选择合适的打印机
  smartPrintOrder(orderData) {
    console.log('🧠 开始智能打印订单:', orderData._id);
    
    // 检查当前连接的打印机类型
    const fruitConnected = this.data.fruitPrinter.connectedDevice;
    const boxlunchConnected = this.data.boxlunchPrinter.connectedDevice;
    console.log('🔌[打印调试] 打印机连接状态:', {
      fruit: {
        connected: !!fruitConnected,
        characteristicReady: !!this.data.fruitPrinter.characteristic,
        device: fruitConnected ? { name: fruitConnected.name || fruitConnected.deviceName, deviceId: fruitConnected.deviceId } : null
      },
      boxlunch: {
        connected: !!boxlunchConnected,
        characteristicReady: !!this.data.boxlunchPrinter.characteristic,
        device: boxlunchConnected ? { name: boxlunchConnected.name || boxlunchConnected.deviceName, deviceId: boxlunchConnected.deviceId } : null
      }
    });
    
    if (!fruitConnected && !boxlunchConnected) {
      console.log('❌ 没有连接任何打印机');
      wx.showToast({
        title: '请先连接打印机',
        icon: 'none'
      });
      return;
    }
    
    const orderTypeInfo = this.detectOrderType(orderData);
    console.log('📋 订单类型检测结果:', orderTypeInfo.type);
    console.log('🍎 水果商品数量:', orderTypeInfo.fruitItems.length);
    console.log('🍱 盒饭商品数量:', orderTypeInfo.boxlunchItems.length);
    
    // 根据连接的打印机类型决定打印策略
    if (fruitConnected) {
      console.log('🍎 当前连接水果打印机');
      if (orderTypeInfo.type === 'fruit') {
        console.log('✅ 纯水果订单，可以打印');
        this.printWithSpecificPrinter(orderData, orderTypeInfo.fruitItems, 'fruit');
      } else {
        console.log('🔄 非水果订单，水果打印机跳过处理');
      }
    } else if (boxlunchConnected) {
       console.log('🍱 当前连接盒饭打印机');
       if (orderTypeInfo.type === 'boxlunch') {
         console.log('✅ 纯盒饭订单，使用盒饭打印机');
         this.printWithSpecificPrinter(orderData, orderTypeInfo.boxlunchItems, 'boxlunch');
       } else if (orderTypeInfo.type === 'mixed') {
         console.log('✅ 混合订单，使用盒饭打印机打印完整订单');
         const allItems = [...orderTypeInfo.fruitItems, ...orderTypeInfo.boxlunchItems];
         this.printWithSpecificPrinter(orderData, allItems, 'boxlunch');
       } else if (orderTypeInfo.type === 'fruit') {
         console.log('🔄 纯水果订单，盒饭打印机跳过处理');
       } else {
         console.log('⚠️ 订单无有效商品');
       }
    }
  },

  // 使用指定打印机打印订单
  printWithSpecificPrinter(orderData, items, printerType) {
    const printerKey = printerType + 'Printer';
    const printer = this.data[printerKey];
    console.log(`🔧[打印调试] 准备指定打印机打印`, {
      orderId: orderData._id,
      printerType,
      itemsCount: items ? items.length : 0,
      device: printer && printer.connectedDevice ? { name: printer.connectedDevice.name || printer.connectedDevice.deviceName, deviceId: printer.connectedDevice.deviceId } : null,
      characteristicReady: !!(printer && printer.characteristic)
    });
    
    if (!printer.connectedDevice) {
      const printerName = printerType === 'fruit' ? '水果打印机' : '盒饭打印机';
      console.log(`❌ ${printerName}未连接`);
      wx.showToast({
        title: `请先连接${printerName}`,
        icon: 'none'
      });
      return false;
    }

    if (!printer.characteristic) {
      const printerName = printerType === 'fruit' ? '水果打印机' : '盒饭打印机';
      console.log(`❌ ${printerName}特征值不可用`);
      wx.showToast({
        title: `${printerName}连接异常`,
        icon: 'none'
      });
      return false;
    }

    try {
      // 创建打印订单数据
      const printOrderData = {
        ...orderData,
        fruitList: items,
        printerType: printerType
      };

      const printContent = this.formatOrderForPrint(printOrderData);
      console.log(`📄 准备使用${printerType === 'fruit' ? '水果' : '盒饭'}打印机打印:`, printContent);
      
      const buffer = this.stringToArrayBuffer(printContent);
      console.log(`📦[打印调试] 订单 ${orderData._id} 打印数据长度: ${buffer.byteLength} 字节`);
      console.log('📡[打印调试] BLE写入目标:', {
        deviceId: printer.characteristic.deviceId,
        serviceId: printer.characteristic.serviceId,
        characteristicId: printer.characteristic.characteristicId
      });

      // 发送到指定打印机
      this.sendDataInChunksWithCallback(buffer, printer.characteristic, () => {
        const printerName = printerType === 'fruit' ? '水果打印机' : '盒饭打印机';
        console.log(`✅ ${printerName}打印成功`);
        wx.showToast({
          title: `${printerName}打印成功`,
          icon: 'success'
        });
      }, (error) => {
        const printerName = printerType === 'fruit' ? '水果打印机' : '盒饭打印机';
        console.error(`❌ ${printerName}打印失败:`, error);
        wx.showToast({
          title: `${printerName}打印失败`,
          icon: 'none'
        });
      });
      
      return true;
    } catch (error) {
      const printerName = printerType === 'fruit' ? '水果打印机' : '盒饭打印机';
      console.error(`${printerName}打印过程出错:`, error);
      wx.showToast({
        title: '打印出错',
        icon: 'none'
      });
      return false;
    }
  },

  // 分类打印订单
  printOrderByCategory(orderData) {
    console.log('🖨️ 开始分类打印订单:', orderData._id);
    
    // 按商品类型分组
    const fruitItems = [];
    const boxlunchItems = [];
    
    if (orderData.fruitList && Array.isArray(orderData.fruitList)) {
      orderData.fruitList.forEach(item => {
        // item格式: [商品名, 数量, 价格, 类型]
        const rawType = item[3];
        const typeNum = Number(rawType);
        const productType = Number.isFinite(typeNum) ? typeNum : 0; // 默认为水果，兼容字符串
        if (productType === 0) {
          fruitItems.push(item);
        } else if (productType === 1) {
          boxlunchItems.push(item);
        }
      });
      const typeSet = Array.from(new Set(orderData.fruitList.map(x => x[3])));
      console.log(`🔎[打印调试] 订单 ${orderData._id} 原始类型字段集合:`, typeSet);
    }

    console.log('水果商品:', fruitItems);
    console.log('盒饭商品:', boxlunchItems);
    console.log(`🔎[打印调试] 订单 ${orderData._id} 分类统计:`, { fruitCount: fruitItems.length, boxlunchCount: boxlunchItems.length });

    // 分别打印不同类型的商品
    if (fruitItems.length > 0) {
      console.log(`🔧[打印调试] 订单 ${orderData._id} 将使用水果打印机打印 ${fruitItems.length} 项`);
      this.printCategoryOrder(orderData, fruitItems, 'fruit');
    }
    
    if (boxlunchItems.length > 0) {
      console.log(`🔧[打印调试] 订单 ${orderData._id} 将使用盒饭打印机打印 ${boxlunchItems.length} 项`);
      this.printCategoryOrder(orderData, boxlunchItems, 'boxlunch');
    }

    if (fruitItems.length === 0 && boxlunchItems.length === 0) {
      wx.showToast({
        title: '订单无有效商品',
        icon: 'none'
      });
    }
  },

  // 打印指定类型的订单
  printCategoryOrder(orderData, items, category) {
    const printerKey = category + 'Printer';
    const characteristic = this.data[printerKey].characteristic;
    console.log(`🔧[打印调试] 分类打印准备`, {
      orderId: orderData._id,
      category,
      itemsCount: items ? items.length : 0,
      characteristicReady: !!characteristic,
      device: this.data[printerKey] && this.data[printerKey].connectedDevice
        ? { name: this.data[printerKey].connectedDevice.name || this.data[printerKey].connectedDevice.deviceName, deviceId: this.data[printerKey].connectedDevice.deviceId }
        : null
    });
    
    if (!characteristic) {
      console.log(`❌[打印调试] ${category === 'fruit' ? '水果' : '盒饭'}打印机未连接或特征值不可用`);
      wx.showToast({
        title: `请先连接${category === 'fruit' ? '水果' : '盒饭'}打印机`,
        icon: 'none'
      });
      return;
    }

    try {
      // 创建分类订单数据
      const categoryOrderData = {
        ...orderData,
        fruitList: items,
        categoryType: category
      };

      const printContent = this.formatCategoryOrderForPrint(categoryOrderData);
      console.log(`准备打印${category}内容:`, printContent);
      
      const buffer = this.stringToArrayBuffer(printContent);
      console.log(`📦[打印调试] 订单 ${orderData._id} (${category}) 打印数据长度: ${buffer.byteLength} 字节`);
      console.log('📡[打印调试] BLE写入目标(分类):', {
        deviceId: characteristic.deviceId,
        serviceId: characteristic.serviceId,
        characteristicId: characteristic.characteristicId
      });

      // 发送到对应的打印机
      this.sendDataInChunksWithCallback(buffer, characteristic, () => {
        console.log(`✅ ${category}订单打印成功`);
        wx.showToast({
          title: `${category === 'fruit' ? '水果' : '盒饭'}订单打印成功`,
          icon: 'success'
        });
      }, (error) => {
        console.error(`❌ ${category}订单打印失败:`, error);
        wx.showToast({
          title: `${category === 'fruit' ? '水果' : '盒饭'}订单打印失败`,
          icon: 'none'
        });
      });
    } catch (error) {
      console.error(`${category}打印过程出错:`, error);
      wx.showToast({
        title: '打印出错',
        icon: 'none'
      });
    }
  },

  // 格式化分类订单打印内容
  formatCategoryOrderForPrint(order) {
    const categoryName = order.categoryType === 'fruit' ? '水果订单' : '盒饭订单';
    
    let content = '';
    
    // 打印机初始化命令
    content += '\x1B\x40'; // ESC @ - 初始化打印机
    
    // 设置字符集为GBK
    content += '\x1C\x26'; // FS & - 选择字符代码表
    content += '\x1C\x43\x01'; // FS C 1 - 选择GBK字符集
    
    // 标题 - 居中，加粗，放大
    content += '\x1B\x61\x01'; // ESC a 1 - 居中对齐
    content += '\x1B\x45\x01'; // ESC E 1 - 加粗开启
    content += '\x1D\x21\x11'; // GS ! 17 - 字符放大2倍
    content += `${categoryName}\n`;
    content += '\x1D\x21\x00'; // GS ! 0 - 恢复正常大小
    content += '\x1B\x45\x00'; // ESC E 0 - 加粗关闭
    content += '\x1B\x61\x00'; // ESC a 0 - 左对齐
    
    // 分隔线
    content += '================================\n';
    
    // 订单信息
    content += `订单号: ${order.out_trade_no || order._id}\n`;
    content += `下单时间: ${order.time || ''}\n`;
    
    // 收货信息
    if (order.address) {
      content += `收货人: ${order.address.userName || ''}\n`;
      content += `电话: ${order.address.telNumber || ''}\n`;
      content += `地址: ${order.address.provinceName || ''}${order.address.cityName || ''}${order.address.countyName || ''}${order.address.detailInfo || ''}\n`;
    }
    
    content += '================================\n';
    
    // 商品列表标题
    content += '\x1B\x45\x01'; // 加粗
    content += '商品清单:\n';
    content += '\x1B\x45\x00'; // 取消加粗
    
    // 商品列表
    let totalAmount = 0;
    if (order.fruitList && Array.isArray(order.fruitList)) {
      order.fruitList.forEach((item, index) => {
        const name = item[0] || '';
        const quantity = item[1] || 0;
        const price = parseFloat(item[2]) || 0;
        const subtotal = quantity * price;
        totalAmount += subtotal;
        
        content += `${index + 1}. ${name}\n`;
        content += `   数量: ${quantity} x ${price.toFixed(2)}元 = ${subtotal.toFixed(2)}元\n`;
      });
    }
    
    content += '--------------------------------\n';
    
    // 总计
    content += '\x1B\x45\x01'; // 加粗
    content += `${categoryName}总计: ${totalAmount.toFixed(2)}元\n`;
    content += '\x1B\x45\x00'; // 取消加粗
    
    content += '================================\n';
    
    // 备注
    if (order.remark) {
      content += `备注: ${order.remark}\n`;
      content += '--------------------------------\n';
    }
    
    // 打印时间
    content += `打印时间: ${app.CurrentTime_show()}\n`;
    
    // 结束 - 换行并切纸
    content += '\n\n\n';
    content += '\x1D\x56\x00'; // GS V 0 - 切纸
    
    return content;
  },

  // 检查模拟打印机连接状态
  

  // 打印订单（原有函数，保持兼容性）
  printOrder(orderData) {
    const characteristic = wx.getStorageSync('printerCharacteristic');
    if (!characteristic) {
      wx.showToast({
        title: '请先连接打印机',
        icon: 'none'
      });
      return;
    }

    try {
      const printContent = this.formatOrderForPrint(orderData);
      console.log('准备打印内容:', printContent);
      
      const buffer = this.stringToArrayBuffer(printContent);
      console.log('转换后的ArrayBuffer:', buffer);

      // 使用分包发送提高兼容性，并添加状态更新回调
      this.sendDataInChunksWithCallback(buffer, characteristic, () => {
        console.log(`✅ 订单 ${orderData._id} 打印成功`);
        wx.showToast({
          title: '打印成功',
          icon: 'success'
        });
        
        // 打印成功后一次性在云端同时标记：已打印 + 已发货
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: {
            orderId: orderData._id,
            updates: {
              printed: true,
              printTime: app.CurrentTime_show(),
              sending: true,
              sendingTime: app.CurrentTime_show()
            }
          }
        }).then(res => {
          if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
            console.log(`📝 订单 ${orderData._id} 打印+发货状态已更新到数据库`);
          } else {
            console.warn('打印+发货状态更新失败或无变化:', res);
          }
          // 刷新当前标签页
          this.refreshCurrentTab();
        }).catch(err => {
          console.error('云函数更新打印+发货状态异常:', err);
          // 仍然尝试刷新
          this.refreshCurrentTab();
        });
      }, (error) => {
        console.error(`❌ 订单 ${orderData._id} 打印失败:`, error);
        wx.showToast({
          title: '打印失败',
          icon: 'none'
        });
      });
    } catch (error) {
      console.error('打印过程出错:', error);
      wx.showToast({
        title: '打印出错',
        icon: 'none'
      });
    }
  },

  // 分包发送数据，提高蓝牙传输兼容性
  sendDataInChunks(buffer, device, chunkSize = 20) {
    const data = new Uint8Array(buffer);
    const totalChunks = Math.ceil(data.length / chunkSize);
    let currentChunk = 0;

    console.log(`开始分包发送，总长度: ${data.length}, 分包数: ${totalChunks}, 每包大小: ${chunkSize}`);

    const sendNextChunk = () => {
      if (currentChunk >= totalChunks) {
        console.log('所有数据包发送完成');
        wx.showToast({
          title: '打印成功',
          icon: 'success'
        });
        return;
      }

      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk = data.slice(start, end);
      const chunkBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

      console.log(`发送第 ${currentChunk + 1}/${totalChunks} 包，大小: ${chunk.length}`);

      wx.writeBLECharacteristicValue({
        deviceId: device.deviceId,
        serviceId: device.serviceId,
        characteristicId: device.characteristicId,
        value: chunkBuffer,
        success: (res) => {
          console.log(`第 ${currentChunk + 1} 包发送成功`);
          currentChunk++;
          // 添加小延迟确保数据传输稳定
          setTimeout(sendNextChunk, 50);
        },
        fail: (err) => {
          console.error(`第 ${currentChunk + 1} 包发送失败:`, err);
          wx.showToast({
            title: `打印失败(包${currentChunk + 1})`,
            icon: 'none'
          });
        }
      });
    };

    sendNextChunk();
  },

  // 带回调的分包发送数据
  sendDataInChunksWithCallback(buffer, device, successCallback, failCallback, chunkSize = 20) {
    const data = new Uint8Array(buffer);
    const totalChunks = Math.ceil(data.length / chunkSize);
    let currentChunk = 0;
    const startTime = Date.now();

    console.log(`开始分包发送，总长度: ${data.length}, 分包数: ${totalChunks}, 每包大小: ${chunkSize}`);
    console.log('📡[打印调试] 分包写入目标:', {
      deviceId: device && device.deviceId,
      serviceId: device && device.serviceId,
      characteristicId: device && device.characteristicId
    });

    const sendNextChunk = () => {
      if (currentChunk >= totalChunks) {
        const duration = Date.now() - startTime;
        console.log(`所有数据包发送完成，用时 ${duration} ms`);
        if (successCallback) successCallback();
        return;
      }

      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk = data.slice(start, end);
      const chunkBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

      console.log(`发送第 ${currentChunk + 1}/${totalChunks} 包，大小: ${chunk.length}`);

      wx.writeBLECharacteristicValue({
        deviceId: device.deviceId,
        serviceId: device.serviceId,
        characteristicId: device.characteristicId,
        value: chunkBuffer,
        success: (res) => {
          console.log(`第 ${currentChunk + 1} 包发送成功`);
          currentChunk++;
          // 添加小延迟确保数据传输稳定
          setTimeout(sendNextChunk, 50);
        },
        fail: (err) => {
          console.error(`第 ${currentChunk + 1} 包发送失败:`, err);
          if (failCallback) failCallback(err);
        }
      });
    };

    sendNextChunk();
  },

  // 手动打印订单并记录状态
  printOrderWithStatus(orderData) {
    // 检查是否正在打印
    if (this.printingOrders.has(orderData._id)) {
      console.log(`⚠️ 订单 ${orderData._id} 正在打印中，跳过重复打印`);
      wx.showToast({
        title: '订单正在打印中',
        icon: 'none'
      });
      return;
    }

    const characteristic = wx.getStorageSync('printerCharacteristic');
    if (!characteristic) {
      wx.showToast({
        title: '请先连接打印机',
        icon: 'none'
      });
      // 打印机未连接时不自动发货，避免“骑手能看到但未打印”场景
      // 请在弹窗中选择“直接发货”或先连接打印机后再打印
      return;
    }

    // 先检查蓝牙连接状态
    this.checkBluetoothConnection(characteristic, (isConnected) => {
      if (!isConnected) {
        console.log('🔄 蓝牙连接已断开，尝试重连...')
        wx.showToast({
          title: '检测到蓝牙断开，尝试重连...',
          icon: 'loading',
          duration: 2000
        })
        
        this.attemptReconnectBluetooth(characteristic, (reconnected) => {
          if (reconnected) {
            console.log('✅ 蓝牙重连成功，继续打印')
            wx.showToast({
              title: '重连成功，开始打印',
              icon: 'success'
            })
            this.executeManualPrint(orderData, characteristic)
          } else {
            console.log('❌ 蓝牙重连失败')
            wx.showToast({
              title: '蓝牙重连失败，请手动重新连接',
              icon: 'none',
              duration: 3000
            })
            // 重连失败不自动发货，避免“未打印已发货”
          }
        })
      } else {
        console.log('✅ 蓝牙连接正常，开始手动打印')
        this.executeManualPrint(orderData, characteristic)
      }
    })
  },

  // 执行手动打印操作
  executeManualPrint(orderData, characteristic) {
    console.log(`🖨️ ===== 开始执行手动打印 =====`);
    console.log(`📋 订单ID: ${orderData._id}`);
    console.log(`🖨️ 打印机特征值: ${JSON.stringify(characteristic)}`);
    
    // 添加到打印锁定集合（本地和全局）
    this.printingOrders.add(orderData._id);
    app.globalData.printingOrders.add(orderData._id);
    console.log(`🔒 订单 ${orderData._id} 已加入打印锁定`);

    // 格式化打印内容
    console.log(`📄 正在格式化打印内容...`);
    const printContent = this.formatOrderForPrint(orderData);
    console.log(`📄 打印内容字符长度: ${printContent.length}`);
    
    const buffer = this.stringToArrayBuffer(printContent);
    console.log(`📦 转换后的数据包大小: ${buffer.byteLength} 字节`);

    // 使用分包发送提高兼容性
    console.log(`📡 开始发送数据到打印机...`);
    this.sendDataInChunksWithCallback(buffer, characteristic, () => {
      console.log(`✅ 手动打印订单 ${orderData._id} 成功`);
      console.log(`🎉 ===== 手动打印成功完成 =====`);
      
      // 从打印锁定集合中移除（本地和全局）
      this.printingOrders.delete(orderData._id);
      app.globalData.printingOrders.delete(orderData._id);
      console.log(`🔓 订单 ${orderData._id} 已从打印锁定中移除`);
      
      wx.showToast({
        title: '打印成功',
        icon: 'success'
      });
      
      // 更新订单打印状态
      // 打印成功后一次性在云端同时标记：已打印 + 已发货
      wx.cloud.callFunction({
        name: 'updateOrderStatus',
        data: {
          orderId: orderData._id,
          updates: {
            printed: true,
            printTime: app.CurrentTime_show(),
            sending: true,
            sendingTime: app.CurrentTime_show()
          }
        }
      }).then(res => {
        if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
          console.log(`📝 订单 ${orderData._id} 打印+发货状态已更新`);
        } else {
          console.warn('打印+发货状态更新失败或无变化:', res);
        }
        // 刷新当前标签页
        this.refreshCurrentTab();
      }).catch(err => {
        console.error('云函数更新打印+发货状态异常:', err);
        // 仍然刷新试图反映任何可能的状态变化
        this.refreshCurrentTab();
      });
    }, (err) => {
      console.error(`❌ 手动打印订单 ${orderData._id} 失败:`, err);
      console.log(`💥 ===== 手动打印失败 =====`);
      
      // 从打印锁定集合中移除（本地和全局）
      this.printingOrders.delete(orderData._id);
      app.globalData.printingOrders.delete(orderData._id);
      console.log(`🔓 订单 ${orderData._id} 已从打印锁定中移除（失败）`);
      
      wx.showToast({
        title: '打印失败',
        icon: 'none'
      });
      // 打印失败不自动发货，避免“骑手能看到但未打印”
    });
  },

  // 格式化订单打印内容
  formatOrderForPrint(order) {
    console.log(`🖨️ ===== 开始格式化订单打印内容 =====`);
    console.log(`📋 订单ID: ${order._id}`);
    console.log(`📋 订单号: ${order.orderNumber || '无'}`);
    console.log(`👤 客户姓名: ${order.name}`);
    console.log(`📞 联系电话: ${order.phone}`);
    console.log(`📍 收货地址: ${order.schoolName}/${order.addressItem}/${order.detail}`);
    console.log(`💰 订单总价: ¥${order.total}`);
    console.log(`📝 备注信息: ${order.message || '无'}`);
    console.log(`⏰ 下单时间: ${order.orderTime}`);
    
    if (order.fruitList && order.fruitList.length > 0) {
      console.log(`🍎 订单商品列表:`);
      order.fruitList.forEach((fruit, index) => {
        console.log(`   ${index + 1}. ${fruit[0]} × ${fruit[1]}`);
      });
    } else {
      console.log(`⚠️ 订单商品列表为空`);
    }
    
    // 使用iconv-lite处理编码，简化ESC/POS命令
    let content = '';
    
    // 1. 初始化打印机
    content += '\x1B\x40'; // ESC @ - 初始化打印机
    
    // 2. 设置居中对齐
    content += '\x1B\x61\x01'; // ESC a 1 - 居中对齐
    
    // 3. 设置字体大小（标题）
    content += '\x1D\x21\x11'; // GS ! 17 - 倍宽倍高
    content += '订单详情\n';
    
    // 4. 恢复正常字体
    content += '\x1D\x21\x00'; // GS ! 0 - 正常字体
    content += '================================\n';
    
    // 5. 设置左对齐
    content += '\x1B\x61\x00'; // ESC a 0 - 左对齐
    
    // 订单号
    content += `订单号: ${order.orderNumber || '无'}\n`;
    content += '--------------------------------\n';
    
    // 客户信息
    content += `客户姓名: ${order.name}\n`;
    content += `联系电话: ${order.phone}\n`;
    content += `收货地址: ${order.detail}\n`;
    content += '--------------------------------\n';
    content += '订单内容:\n';
    
    if (order.fruitList && order.fruitList.length > 0) {
      order.fruitList.forEach(fruit => {
        content += `${fruit[0]} × ${fruit[1]}\n`;
      });
    }
    
    content += '--------------------------------\n';
    
    // 6. 设置加粗
    content += '\x1B\x45\x01'; // ESC E 1 - 加粗开启
    content += `订单总价: ${order.total}元\n`;
    content += '\x1B\x45\x00'; // ESC E 0 - 加粗关闭
    
    content += `备注信息: ${order.message || '无'}\n`;
    content += `下单时间: ${order.orderTime}\n`;
    content += '================================\n';
    
    // 7. 走纸并切纸
    content += '\x1B\x64\x03'; // ESC d 3 - 走纸3行
    content += '\x1D\x56\x00'; // GS V 0 - 全切纸
    
    console.log(`📄 ===== 打印机将要打印的完整内容 =====`);
    console.log(`打印内容预览:`);
    console.log(`================================`);
    console.log(`           订单详情`);
    console.log(`================================`);
    console.log(`订单号: ${order.orderNumber || '无'}`);
    console.log(`--------------------------------`);
    console.log(`客户姓名: ${order.name}`);
    console.log(`联系电话: ${order.phone}`);
    console.log(`收货地址: ${order.schoolName}/${order.addressItem}/${order.detail}`);
    console.log(`--------------------------------`);
    console.log(`订单内容:`);
    if (order.fruitList && order.fruitList.length > 0) {
      order.fruitList.forEach(fruit => {
        console.log(`${fruit[0]} × ${fruit[1]}`);
      });
    }
    console.log(`--------------------------------`);
    console.log(`订单总价: ¥${order.total}`);
    console.log(`备注信息: ${order.message || '无'}`);
    console.log(`下单时间: ${order.orderTime}`);
    console.log(`================================`);
    console.log(`🖨️ ===== 打印内容格式化完成 =====`);
    
    return content;
  },

  // 字符串转ArrayBuffer（使用GBK编码解决中文乱码）
  stringToArrayBuffer(str) {
    console.log('开始转换字符串到ArrayBuffer:', str);
    
    try {
      // 使用GBK编码模块处理中文字符
      const buffer = gbkEncoder.stringToArrayBuffer(str);
      console.log('使用GBK编码成功，字节长度:', buffer.byteLength);
      return buffer;
    } catch (error) {
      console.error('GBK编码失败，使用备用方案:', error);
      
      // 备用方案：简单的ASCII编码
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 128) {
          // ASCII字符直接使用
          bytes.push(code);
        } else {
          // 非ASCII字符使用空格替代，避免乱码
          bytes.push(32); // 空格的ASCII码
        }
      }
      
      const buffer = new ArrayBuffer(bytes.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i++) {
        view[i] = bytes[i];
      }
      
      console.log('使用ASCII备用方案，字节长度:', bytes.length);
      return buffer;
    }
  },



  // 显示/隐藏蓝牙设备列表
  toggleBluetoothModal() {
    this.setData({
      showBluetoothModal: !this.data.showBluetoothModal
    })
  },

  // 切换自动发货开关
  toggleAutoShipping(e) {
    const enabled = e.detail.value
    console.log('切换自动发货状态:', enabled)
    
    this.setData({
      autoShippingEnabled: enabled
    })

    if (enabled) {
      this.startAutoShipping()
      wx.showToast({
        title: '自动发货已启用',
        icon: 'success'
      })
    } else {
      this.stopAutoShipping()
      wx.showToast({
        title: '自动发货已禁用',
        icon: 'none'
      })
    }
  },

  // 切换自动打印开关
  toggleAutoPrint(e) {
    const enabled = e.detail.value
    console.log('切换自动打印状态:', enabled)
    
    this.setData({
      autoPrintEnabled: enabled
    })

    wx.showToast({
      title: enabled ? '自动打印已启用' : '自动打印已禁用',
      icon: enabled ? 'success' : 'none'
    })
  },
  
  // ----------------------!!!  新订单监听功能  !!!----------------------
  // 开始订单监听
  startOrderMonitoring() {
    const that = this;
    
    // 检查是否已经有订单监听定时器在运行
    if (that.data.orderCheckInterval) {
      console.log('⚠️ 订单监听定时器已存在，跳过重复启动');
      return;
    }
    
    console.log('🔔 启动订单监听，每30秒检查一次新订单');
    
    // 每30秒检查一次新订单
    that.data.orderCheckInterval = setInterval(() => {
      that.checkNewOrders();
    }, 30000);
    
    // 初始化订单数量
    that.getInitialOrderCount();
    
    console.log('✅ 订单监听已启动，定时器ID:', that.data.orderCheckInterval);
  },

  // 获取初始订单数量
  getInitialOrderCount() {
    const that = this;
    console.log('📊 获取初始订单数量...');
    
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      // 使用与检查新订单相同的过滤条件
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      );
      
      const orderIds = new Set(paidOrders.map(o => o._id));
      
      // 初始化订单ID集合
      that.lastOrderIds = orderIds;
      
      that.setData({
        lastOrderCount: paidOrders.length
      });
      
      console.log(`✅ 初始订单数量: ${paidOrders.length}`);
      console.log(`✅ 初始订单ID集合大小: ${orderIds.size}`);
      if (paidOrders.length > 0) {
        console.log(`📝 初始订单ID(最多5个):`, Array.from(orderIds).slice(0, 5));
      }
    });
  },

  // 检查新订单
  checkNewOrders() {
    const that = this;
    console.log('🔍 ===== 开始检查新订单 =====');
    
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      // 过滤条件：已支付、未发货、未打印的订单
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      );
      
      const currentOrderCount = paidOrders.length;
      const currentOrderIds = new Set(paidOrders.map(o => o._id));
      
      console.log('🔔[打印调试] 当前可处理订单数量:', currentOrderCount);
      console.log('🔔[打印调试] 上次记录的订单数量:', that.data.lastOrderCount);
      console.log('🔔[打印调试] 可处理订单ID列表(最多10个):', Array.from(currentOrderIds).slice(0, 10));
      
      // 初始化时没有 lastOrderIds，不触发通知
      if (!that.lastOrderIds) {
        console.log('📌 初始化订单ID集合');
        that.lastOrderIds = currentOrderIds;
        that.setData({
          lastOrderCount: currentOrderCount
        });
        return;
      }
      
      // 找出新增的订单（当前ID集合中有，但上次没有）
      const newOrderIds = Array.from(currentOrderIds).filter(id => !that.lastOrderIds.has(id));
      
      if (newOrderIds.length > 0) {
        console.log('🆕[打印调试] 检测到 ' + newOrderIds.length + ' 个新订单:', newOrderIds);
        
        // 找到第一个新订单
        const firstNewOrder = paidOrders.find(o => o._id === newOrderIds[0]);
        that.showNewOrderNotification(newOrderIds.length, firstNewOrder);
        
        // 更新订单ID集合和数量
        that.lastOrderIds = currentOrderIds;
        that.setData({
          lastOrderCount: currentOrderCount
        });
        
        // 刷新订单列表
        that.getAllList();
      } else {
        console.log('✅ 没有新订单');
        // 仍然更新状态，以防订单被删除或状态变化
        that.lastOrderIds = currentOrderIds;
        that.setData({
          lastOrderCount: currentOrderCount
        });
      }
    });
  },

  // 显示新订单提醒
  showNewOrderNotification(count, latestOrder) {
    // 震动提醒
    wx.vibrateShort();
    
    // 声音提醒（如果支持）
    wx.playBackgroundAudio && wx.playBackgroundAudio({
      dataUrl: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
    });
    
    // Toast提醒
    wx.showToast({
      title: `收到${count}个新订单`,
      icon: 'success',
      duration: 2000
    });
    
    // 自动处理新订单
    this.processNewOrders(count, latestOrder);
  },

  // 处理新订单（自动打印和发货）
  processNewOrders(count, latestOrder) {
    const that = this;
    
    // 获取所有待处理订单
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      const paidOrders = e.data.filter(order => order.paySuccess && !order.sending);
      
      // 处理每个新订单
      paidOrders.slice(0, count).forEach((order, index) => {
        setTimeout(() => {
          that.processNewOrder(order);
        }, index * 1000); // 每个订单间隔1秒处理，避免并发问题
      });
    });
  },

  // 处理单个新订单
  processNewOrder(order) {
    console.log(`🆕 处理新订单: ${order._id}`);
    
    // 检查是否启用自动打印
    if (this.data.autoPrintEnabled) {
      this.autoPrintOrder(order);
    } else {
      // 自动打印被禁用时，不进行自动发货，等待人工打印后发货
      console.log(`⚠️ 自动打印已禁用，跳过自动发货，等待手动打印`)
      wx.showToast({
        title: '自动打印已禁用，请手动打印后发货',
        icon: 'none'
      })
    }
  },

  // 停止订单监听
  stopOrderMonitoring() {
    if (this.data.orderCheckInterval) {
      console.log('🛑 停止订单监听，清除定时器ID:', this.data.orderCheckInterval);
      clearInterval(this.data.orderCheckInterval);
      this.setData({
        orderCheckInterval: null
      });
      console.log('✅ 订单监听已停止');
    } else {
      console.log('⚠️ 没有运行中的订单监听定时器');
    }
  },

  // 启动自动发货检查
  startAutoShipping() {
    if (!this.data.autoShippingEnabled) {
      console.log('⚠️ 自动发货功能已禁用')
      return
    }
    
    // 检查是否已经有自动发货定时器在运行
    if (this.data.autoShippingInterval) {
      console.log('⚠️ 自动发货定时器已存在，跳过重复启动');
      return;
    }

    console.log('🚚 启动自动发货检查，每30秒检查一次')
    
    // 立即执行一次检查
    this.checkPendingOrders()
    
    // 每30秒检查一次待发货订单
    const interval = setInterval(() => {
      this.checkPendingOrders()
    }, 30000)
    
    this.setData({
      autoShippingInterval: interval
    })
    
    console.log('✅ 自动发货检查已启动，定时器ID:', interval);
  },

  // 停止自动发货检查
  stopAutoShipping() {
    if (this.data.autoShippingInterval) {
      console.log('🛑 停止自动发货检查，清除定时器ID:', this.data.autoShippingInterval);
      clearInterval(this.data.autoShippingInterval)
      this.setData({
        autoShippingInterval: null
      })
      console.log('✅ 自动发货检查已停止')
    } else {
      console.log('⚠️ 没有运行中的自动发货定时器');
    }
  },

  // 检查待发货订单
  checkPendingOrders() {
    if (!this.data.autoShippingEnabled) return
    
    console.log('🔍 检查待发货订单...')
    
    app.getInfoByOrder('order_master', 'orderTime', 'desc', (orders) => {
      if (!orders || !orders.data || orders.data.length === 0) {
        console.log('没有找到订单数据')
        return
      }

      // 获取24小时前的时间戳
      const now = new Date()
      const twentyFourHoursAgo = dateUtils.getDateHoursAgo(24, now)
      
      console.log(`📅 当前时间: ${now.toLocaleString()}`)
      console.log(`⏰ 24小时前: ${twentyFourHoursAgo.toLocaleString()}`)

      // 筛选已支付但未发货的订单，排除已打印、已发货、已完成和正在打印的订单
      const pendingOrders = orders.data.filter(order => {
        // 基本条件：已支付且未发货未完成
        const basicCondition = order.paySuccess === true && 
                              order.sending !== true &&
                              order.finished !== true;
        
        // 排除正在打印的订单（本地和全局）
        const notPrinting = !this.printingOrders.has(order._id) && 
                           !app.globalData.printingOrders.has(order._id);
        
        // 注意：不排除已打印的订单，因为已打印的订单应该直接发货
        
        // 时间筛选：只处理最近24小时内的订单
        let isRecent = false
        if (order.orderTime) {
          try {
            // 使用iOS兼容的日期解析函数
            const orderDate = dateUtils.parseDate(order.orderTime)
            if (orderDate) {
              isRecent = orderDate >= twentyFourHoursAgo
              
              if (!isRecent) {
                console.log(`⏰ 跳过24小时前的订单: ${order._id}, 订单时间: ${order.orderTime}`)
              }
            } else {
              console.log(`❌ 订单时间解析失败: ${order._id}, 时间: ${order.orderTime}`)
              isRecent = false
            }
          } catch (error) {
            console.log(`❌ 订单时间解析异常: ${order._id}, 时间: ${order.orderTime}`, error)
            isRecent = false
          }
        }
        
        return basicCondition && notPrinting && isRecent;
      })
      console.log(`📋 找到 ${pendingOrders.length} 个待发货订单`)
      
      // 完整打印每个待发货订单的详细信息
      if (pendingOrders.length > 0) {
        console.log('\n=== 待发货订单详细信息 ===')
        pendingOrders.forEach((order, index) => {
          console.log(`\n📦 订单 ${index + 1}:`)
          console.log(`  订单ID: ${order._id}`)
          console.log(`  订单时间: ${order.orderTime}`)
          console.log(`  订单状态: ${order.orderStatus || '未知'}`)
          console.log(`  支付状态: ${order.paySuccess ? '已支付' : '未支付'}`)
          console.log(`  打印状态: ${order.printed ? '已打印' : '未打印'}`)
          console.log(`  发货状态: ${order.sending ? '已发货' : '未发货'}`)
          console.log(`  完成状态: ${order.finished ? '已完成' : '未完成'}`)
          console.log(`  订单金额: ¥${order.total || '0.00'}`)
          console.log(`  用户openid: ${order._openid || '未知'}`)
          
          // 打印订单商品信息
          if (order.orderItems && order.orderItems.length > 0) {
            console.log(`  商品信息 (${order.orderItems.length}件):`)
            order.orderItems.forEach((item, itemIndex) => {
              console.log(`    ${itemIndex + 1}. ${item.name} - ¥${item.price}/${item.unit} × ${item.num}`)
            })
          } else {
            console.log(`  商品信息: 无`)
          }
          
          // 打印收货地址信息
          if (order.address) {
            console.log(`  收货地址:`)
            console.log(`    收货人: ${order.address.name || '未知'}`)
            console.log(`    电话: ${order.address.phone || '未知'}`)
            console.log(`    学校: ${order.address.schoolName || '未知'}`)
            console.log(`    地址: ${order.address.addressItem || ''} ${order.address.apartmentNum || ''} ${order.address.detail || ''}`)
            if (order.address.message) {
              console.log(`    备注: ${order.address.message}`)
            }
          } else {
            console.log(`  收货地址: 无`)
          }
          
          // 打印时间戳信息
          if (order.payTime) console.log(`  支付时间: ${order.payTime}`)
          if (order.sendingTime) console.log(`  发货时间: ${order.sendingTime}`)
          if (order.finishedTime) console.log(`  完成时间: ${order.finishedTime}`)
          
          console.log(`  ----------------------------------------`)
        })
        console.log('=== 订单信息打印完成 ===\n')
        // 处理每个待发货订单
        pendingOrders.forEach((order, index) => {
          // 添加延迟避免并发问题
          setTimeout(() => {
            this.processAutoShipping(order)
          }, index * 500)
        })
      }
    })
  },

  // 处理单个订单的自动发货
  processAutoShipping(order) {
    console.log(`📦 处理订单自动发货: ${order._id}`)
    
    // 检查是否已经打印过
    if (order.printed === true) {
      console.log(`✅ 订单 ${order._id} 已打印过，执行自动发货`)
      this.updateOrderToShipping(order._id)
      return
    }

    // 如果订单未打印，检查是否可以自动打印
    if (this.data.autoPrintEnabled && this.isBluetoothConnected()) {
      console.log(`📄 订单 ${order._id} 未打印，开始自动打印`)
      this.autoPrintOrder(order)
    } else {
      console.log(`⚠️ 订单 ${order._id} 未打印且无法自动打印（打印机未连接或自动打印已禁用），跳过自动发货`)
      console.log(`💡 提示：该订单需要手动打印后才能发货`)
      // 不执行自动发货，等待手动处理
    }
  },

  // 检查蓝牙打印机是否已连接
  isBluetoothConnected() {
    // 优先根据新的双打印机状态判断
    const hasFruitPrinter = this.data.fruitPrinter
      && this.data.fruitPrinter.connectedDevice
      && this.data.fruitPrinter.characteristic

    const hasBoxlunchPrinter = this.data.boxlunchPrinter
      && this.data.boxlunchPrinter.connectedDevice
      && this.data.boxlunchPrinter.characteristic

    console.log('🔌[打印调试] 当前打印机连接检测:', {
      fruitConnected: !!hasFruitPrinter,
      boxlunchConnected: !!hasBoxlunchPrinter
    })

    if (hasFruitPrinter || hasBoxlunchPrinter) {
      return true
    }

    // 兼容旧版单打印机存储逻辑
    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (!characteristic) {
      return false
    }
    // 真实设备的连接检查
    return !!(characteristic && characteristic.deviceId)
  },

  // 自动打印订单
  autoPrintOrder(order) {
    // 检查订单是否已经打印过
    if (order.printed === true) {
      console.log(`✅ 订单 ${order._id} 已打印过，直接发货`)
      this.updateOrderToShipping(order._id)
      return
    }

    // 检查订单是否已经发货
    if (order.sending === true) {
      console.log(`📦 订单 ${order._id} 已发货，跳过打印`)
      return
    }

    // 检查是否正在打印
    if (this.printingOrders.has(order._id) || app.globalData.printingOrders.has(order._id)) {
      console.log(`⚠️ 订单 ${order._id} 正在打印中，跳过重复自动打印`)
      return
    }

    console.log('🖨️ 使用自动打印流程（executeAutoPrint）')
    console.log('🔎[自动打印] 订单状态快照:', {
      orderId: order._id,
      paySuccess: order.paySuccess,
      printed: order.printed,
      sending: order.sending,
      fruitListLen: Array.isArray(order.fruitList) ? order.fruitList.length : 0
    })

    // 优先使用双打印机的特征值
    const fruitChar = this.data.fruitPrinter && this.data.fruitPrinter.characteristic
    const boxChar = this.data.boxlunchPrinter && this.data.boxlunchPrinter.characteristic
    let targetChar = null

    if (fruitChar || boxChar) {
      const orderTypeInfo = this.detectOrderType(order)
      console.log('🔎[自动打印] 订单类型检测结果:', orderTypeInfo.type)

      if (fruitChar && !boxChar) {
        // 仅连接水果打印机：只自动打印水果/混合订单
        if (orderTypeInfo.type === 'fruit' || orderTypeInfo.type === 'mixed') {
          targetChar = fruitChar
        } else {
          console.log(`🔄 订单 ${order._id} 非水果订单，当前仅连接水果打印机，跳过自动打印`)
          return
        }
      } else if (boxChar && !fruitChar) {
        // 仅连接盒饭打印机：只自动打印盒饭/混合订单
        if (orderTypeInfo.type === 'boxlunch' || orderTypeInfo.type === 'mixed') {
          targetChar = boxChar
        } else {
          console.log(`🔄 订单 ${order._id} 非盒饭订单，当前仅连接盒饭打印机，跳过自动打印`)
          return
        }
      } else if (fruitChar && boxChar) {
        // 两台都连：水果订单走水果机，盒饭/混合订单走盒饭机
        if (orderTypeInfo.type === 'fruit') {
          targetChar = fruitChar
        } else if (orderTypeInfo.type === 'boxlunch' || orderTypeInfo.type === 'mixed') {
          targetChar = boxChar
        } else {
          console.log(`⚠️ 订单 ${order._id} 无有效商品，跳过自动打印`)
          return
        }
      }
    }

    // 如果双打印机都未连接，则回退到旧的单打印机特征值
    if (!targetChar) {
      const oldChar = wx.getStorageSync('printerCharacteristic')
      if (oldChar && oldChar.deviceId) {
        console.log('🔁 使用旧版单打印机特征值进行自动打印')
        targetChar = oldChar
      }
    }

    if (!targetChar) {
      console.log(`⚠️ 订单 ${order._id} 未找到可用打印机特征值，跳过自动打印`)
      return
    }

    // 使用统一的自动打印流程（带打印锁和状态更新）
    this.executeAutoPrint(order, targetChar)
  },

  // 执行自动打印操作
  executeAutoPrint(order, characteristic) {
    console.log(`🤖 ===== 开始执行自动打印 =====`);
    console.log(`📋 订单ID: ${order._id}`);
    console.log(`� 订单号: ${order.orderNumber || '无'}`);
    console.log(`👤 客户: ${order.name} - ${order.phone}`);
    console.log(`�️ 打印机特征值: ${JSON.stringify(characteristic)}`);
    console.log(`🔍 当前打印锁集合大小(本地): ${this.printingOrders.size}`);
    console.log(`🔍 当前打印锁集合大小(全局): ${app.globalData.printingOrders.size}`);
    
    // 检查是否正在打印
    if (this.printingOrders.has(order._id)) {
      console.log(`⚠️ 订单 ${order._id} 已在本地打印锁中，跳过重复自动打印`);
      return;
    }
    
    if (app.globalData.printingOrders.has(order._id)) {
      console.log(`⚠️ 订单 ${order._id} 已在全局打印锁中，跳过重复自动打印`);
      return;
    }

    try {
      // 添加到打印锁定集合（本地和全局）
      this.printingOrders.add(order._id);
      app.globalData.printingOrders.add(order._id);
      console.log(`🔒 订单 ${order._id} 已加入自动打印锁定`);
      console.log(`🔒 更新后打印锁大小 - 本地: ${this.printingOrders.size}, 全局: ${app.globalData.printingOrders.size}`);
      
      // 检查蓝牙连接状态
      console.log(`🔌 检查蓝牙连接状态...`);
      console.log(`🔌 打印机设备ID: ${characteristic.deviceId}`);
      console.log(`🔌 服务ID: ${characteristic.serviceId}`);
      console.log(`🔌 特征值ID: ${characteristic.characteristicId}`);

      // 真实设备的打印流程
      console.log(`📄 正在格式化自动打印内容...`);
      // 格式化打印内容
      const printContent = this.formatOrderForPrint(order)
      console.log(`📄 自动打印内容字符长度: ${printContent.length}`);
      
      const buffer = this.stringToArrayBuffer(printContent)
      console.log(`📦 自动打印数据包大小: ${buffer.byteLength} 字节`);

      // 使用分包发送提高兼容性
      console.log(`📡 开始发送自动打印数据到打印机...`);
    this.sendDataInChunksWithCallback(buffer, characteristic, () => {
      console.log(`✅ 订单 ${order._id} 自动打印数据发送成功`)
      console.log(`🎉 ===== 自动打印成功完成 =====`);
        
        // 从打印锁定集合中移除（本地和全局）
        this.printingOrders.delete(order._id);
        app.globalData.printingOrders.delete(order._id);
        console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除`);
        console.log(`🔓 移除后打印锁大小 - 本地: ${this.printingOrders.size}, 全局: ${app.globalData.printingOrders.size}`);
        
        // 自动打印成功后一次性在云端同时标记：已打印 + 已发货
        console.log(`📤 开始更新订单 ${order._id} 状态为：已打印 + 已发货`);
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: {
            orderId: order._id,
            updates: {
              printed: true,
              printTime: app.CurrentTime_show(),
              sending: true,
              sendingTime: app.CurrentTime_show()
            }
          }
        }).then(res => {
          if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
            console.log(`✅ 订单 ${order._id} 打印+发货状态已更新`)
            console.log(`✅ 云函数更新结果:`, res.result)
          } else {
            console.warn('⚠️ 自动打印+发货状态更新失败或无变化:', res)
          }
          // 刷新当前标签页
          console.log(`🔄 刷新订单列表...`);
          this.refreshCurrentTab()
        }).catch(err => {
          console.error('❌ 云函数更新自动打印+发货状态异常:', err)
          // 仍然尝试刷新
          console.log(`🔄 尝试刷新订单列表...`);
          this.refreshCurrentTab()
        })
      }, (err) => {
        console.error(`❌ 订单 ${order._id} 自动打印失败:`, err)
        console.error(`❌ 错误详情:`, JSON.stringify(err));
        console.log(`💥 ===== 自动打印失败 =====`);
        
        // 从打印锁定集合中移除（本地和全局）
        this.printingOrders.delete(order._id);
        app.globalData.printingOrders.delete(order._id);
        console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除（失败）`);
        console.log(`🔓 移除后打印锁大小 - 本地: ${this.printingOrders.size}, 全局: ${app.globalData.printingOrders.size}`);
        
        // 自动打印失败不自动发货，等待手动处理（打印或直接发货）
        console.log(`⚠️ 订单 ${order._id} 自动打印失败，订单保持未发货状态，等待手动处理`);
      })
    } catch (error) {
      console.error(`❌ 自动打印订单 ${order._id} 过程出错:`, error)
      console.error(`❌ 异常堆栈:`, error.stack || '无堆栈信息');
      console.log(`💥 ===== 自动打印出错 =====`);
      
      // 从打印锁定集合中移除（本地和全局）
      this.printingOrders.delete(order._id);
      app.globalData.printingOrders.delete(order._id);
      console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除（出错）`);
      console.log(`🔓 移除后打印锁大小 - 本地: ${this.printingOrders.size}, 全局: ${app.globalData.printingOrders.size}`);
      
      // 不自动发货：保持未发货状态，等待人工检查后重试打印
      console.log(`⚠️ 订单 ${order._id} 保持未发货状态，等待人工检查后重试`);
      wx.showToast({
        title: '自动打印失败，请检查打印机连接',
        icon: 'none'
      })
    }
  },

  // 检查蓝牙连接状态
  checkBluetoothConnection(characteristic, callback) {
    if (!characteristic || !characteristic.deviceId) {
      console.log('🔍[打印调试] 检查蓝牙连接失败：无有效特征值或deviceId');
      callback(false)
      return
    }
    // 真实设备的蓝牙连接检查
    console.log('🔍[打印调试] 开始检查蓝牙设备服务', { deviceId: characteristic.deviceId });
    wx.getBLEDeviceServices({
      deviceId: characteristic.deviceId,
      success: (res) => {
        console.log('🔍 蓝牙设备服务检查成功，连接正常')
        callback(true)
      },
      fail: (err) => {
        console.log('🔍 蓝牙设备服务检查失败，连接可能已断开:', err)
        callback(false)
      }
    })
  },

  // 尝试重新连接蓝牙
  attemptReconnectBluetooth(characteristic, callback) {
    if (!characteristic || !characteristic.deviceId) {
      console.log('🔄[打印调试] 重连蓝牙失败：无有效特征值或deviceId');
      callback(false)
      return
    }

    console.log('🔄 开始重连蓝牙设备...')
    
    // 先尝试直接连接
    wx.createBLEConnection({
      deviceId: characteristic.deviceId,
      success: (res) => {
        console.log('✅ 蓝牙设备重连成功')
        
        // 重连成功后，重新获取服务和特征值
        setTimeout(() => {
          wx.getBLEDeviceServices({
            deviceId: characteristic.deviceId,
            success: (servicesRes) => {
              console.log('✅ 重新获取蓝牙服务成功')
              callback(true)
            },
            fail: (servicesErr) => {
              console.error('❌ 重新获取蓝牙服务失败:', servicesErr)
              callback(false)
            }
          })
        }, 1000) // 等待1秒确保连接稳定
      },
      fail: (err) => {
        console.error('❌ 蓝牙设备重连失败:', err)
        callback(false)
      }
    })
  },

  // 更新订单为发货状态
  updateOrderToShipping(orderId) {
    console.log(`🚚 更新订单 ${orderId} 为发货状态（校验 printed）`)
    // 从本地列表尝试获取订单信息
    const lists = [
      this.data.orderList || [],
      this.data.displayOrderList || [],
      this.data.allOrderList || []
    ]
    const localOrder = lists.reduce((found, list) => found || list.find(o => o._id === orderId), null)
    const localPrinted = localOrder ? localOrder.printed === true : null

    // 本地明确未打印，阻止发货
    if (localPrinted === false) {
      wx.showToast({ title: '请先打印再发货', icon: 'none' })
      return
    }

    // 本地未知打印状态，查询数据库后再决定
    if (localPrinted === null) {
      const db = wx.cloud.database()
      db.collection('order_master').doc(orderId).get().then(res => {
        const doc = res && res.data
        if (!doc || doc.printed !== true) {
          wx.showToast({ title: '请先打印再发货', icon: 'none' })
          return
        }
        // 已确认打印，执行发货更新
        wx.cloud.callFunction({
          name: 'updateOrderStatus',
          data: {
            orderId,
            updates: {
              sending: true,
              sendingTime: app.CurrentTime_show()
            }
          }
        }).then(res2 => {
          if (res2 && res2.result && res2.result.success && res2.result.stats && res2.result.stats.updated > 0) {
            console.log(`✅ 订单 ${orderId} 已自动发货`)
          } else {
            console.warn('自动发货更新失败或无变化:', res2)
          }
          this.refreshCurrentTab()
        }).catch(err2 => {
          console.error('云函数更新发货状态异常:', err2)
          this.refreshCurrentTab()
        })
      }).catch(err => {
        console.error('获取订单打印状态失败:', err)
        wx.showToast({ title: '获取订单状态失败，请重试', icon: 'none' })
      })
      return
    }

    // 本地已确认 printed===true，直接执行发货更新
    wx.cloud.callFunction({
      name: 'updateOrderStatus',
      data: {
        orderId,
        updates: {
          sending: true,
          sendingTime: app.CurrentTime_show()
        }
      }
    }).then(res => {
      if (res && res.result && res.result.success && res.result.stats && res.result.stats.updated > 0) {
        console.log(`✅ 订单 ${orderId} 已自动发货`)
      } else {
        console.warn('自动发货更新失败或无变化:', res)
      }
      this.refreshCurrentTab()
    }).catch(err => {
      console.error('云函数更新发货状态异常:', err)
      this.refreshCurrentTab()
    })
  },

  // 获取所有订单信息
  getAllList:function(){
    // 兼容旧调用：改为分页刷新当前标签页
    this.refreshCurrentTab()
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
    console.log('👀 ===== bgManage页面显示 =====');
    
    // 清理旧的单打印机存储数据，避免与双打印机逻辑冲突
    const oldCharacteristic = wx.getStorageSync('printerCharacteristic')
    if (oldCharacteristic) {
      console.log('🔄 检测到旧的打印机存储数据，正在迁移到双打印机格式')
      // 根据设备名称判断是水果打印机还是盒饭打印机
      const deviceName = oldCharacteristic.name || ''
      if (deviceName.includes('水果') || deviceName.includes('fruit')) {
        // 迁移到水果打印机存储
        wx.setStorageSync('fruitPrinterCharacteristic', oldCharacteristic)
        if (oldCharacteristic.deviceId) {
          wx.setStorageSync('fruitPrinterDevice', {
            deviceId: oldCharacteristic.deviceId,
            name: deviceName || '水果打印机'
          })
        }
      } else if (deviceName.includes('盒饭') || deviceName.includes('boxlunch')) {
        // 迁移到盒饭打印机存储
        wx.setStorageSync('boxlunchPrinterCharacteristic', oldCharacteristic)
        if (oldCharacteristic.deviceId) {
          wx.setStorageSync('boxlunchPrinterDevice', {
            deviceId: oldCharacteristic.deviceId,
            name: deviceName || '盒饭打印机'
          })
        }
      }
      // 清除旧的存储
      wx.removeStorageSync('printerCharacteristic')
      console.log('✅ 旧打印机数据迁移完成')
    }
    
    this.getAllList()
    this.getInitialOrderCount()
    
    // 检查并显示打印机连接状态（只使用双打印机检查）
    this.checkDualPrinterStatus() // 检查双打印机状态
    
    // 注意：startOrderMonitoring 和 startAutoShipping 内部已经有重复检查
    // 所以即使多次调用 onShow 也不会创建多个定时器
    this.startOrderMonitoring()
    this.startAutoShipping() // 启动自动发货检查
    
    // 通知全局停止后台处理，页面接管
    app.globalData.backgroundOrderProcessing = false
    console.log('📱 bgManage页面显示完成，接管订单处理')
    console.log('🔔 当前订单监听定时器ID:', this.data.orderCheckInterval);
    console.log('🚚 当前自动发货定时器ID:', this.data.autoShippingInterval);
  },

  // 检查打印机连接状态
  checkPrinterConnectionStatus() {
    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (characteristic) {
      // 真实打印机
      this.setData({
        connectedDevice: {
          name: characteristic.name || '蓝牙打印机',
          deviceId: characteristic.deviceId,
          mockDevice: false
        }
      })
    } else {
      this.setData({
        connectedDevice: null
      })
    }
  },

  // 检查双打印机状态
  checkDualPrinterStatus() {
    // 检查水果打印机
    const fruitCharacteristic = wx.getStorageSync('fruitPrinterCharacteristic');
    const fruitDevice = wx.getStorageSync('fruitPrinterDevice');
    
    if (fruitCharacteristic && fruitDevice) {
      // 验证设备是否真的还连接着
      this.validatePrinterConnection('fruit', fruitDevice, fruitCharacteristic);
    } else if (fruitCharacteristic) {
      // 兼容旧版本存储格式
      const deviceInfo = {
        deviceId: fruitCharacteristic.deviceId,
        name: '水果打印机'
      };
      this.validatePrinterConnection('fruit', deviceInfo, fruitCharacteristic);
    } else {
      // 没有水果打印机连接，清空状态
      this.setData({
        'fruitPrinter.connectedDevice': null,
        'fruitPrinter.characteristic': null
      });
      console.log('🍎 水果打印机未连接，已清空状态');
    }

    // 检查盒饭打印机
    const boxlunchCharacteristic = wx.getStorageSync('boxlunchPrinterCharacteristic');
    const boxlunchDevice = wx.getStorageSync('boxlunchPrinterDevice');
    
    if (boxlunchCharacteristic && boxlunchDevice) {
      // 验证设备是否真的还连接着
      this.validatePrinterConnection('boxlunch', boxlunchDevice, boxlunchCharacteristic);
    } else if (boxlunchCharacteristic) {
      // 兼容旧版本存储格式
      const deviceInfo = {
        deviceId: boxlunchCharacteristic.deviceId,
        name: '盒饭打印机'
      };
      this.validatePrinterConnection('boxlunch', deviceInfo, boxlunchCharacteristic);
    } else {
      // 没有盒饭打印机连接，清空状态
      this.setData({
        'boxlunchPrinter.connectedDevice': null,
        'boxlunchPrinter.characteristic': null
      });
      console.log('🍱 盒饭打印机未连接，已清空状态');
    }
  },

  // 验证打印机连接状态
  validatePrinterConnection(type, device, characteristic) {
    const that = this;
    const printerKey = type + 'Printer';
    const printerName = type === 'fruit' ? '水果打印机' : '盒饭打印机';
    const emoji = type === 'fruit' ? '🍎' : '🍱';
    
    if (!device || !device.deviceId) {
      console.log(`${emoji} ${printerName}设备信息不完整，清空状态`);
      that.clearPrinterConnection(type);
      return;
    }

    // 检查BLE连接状态
    wx.getBLEDeviceServices({
      deviceId: device.deviceId,
      success: function(res) {
        // 能够获取服务说明设备还连接着
        console.log(`${emoji} ${printerName}连接验证成功:`, device.name);
        that.setData({
          [`${printerKey}.connectedDevice`]: device,
          [`${printerKey}.characteristic`]: characteristic
        });
      },
      fail: function(err) {
        // 无法获取服务说明设备已断开
        console.log(`${emoji} ${printerName}连接验证失败，设备已断开:`, err);
        that.clearPrinterConnection(type);
      }
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    console.log('👋 ===== bgManage页面隐藏 =====');
    this.stopOrderMonitoring()
    this.stopAutoShipping()
    
    // 启用全局后台处理
    app.globalData.backgroundOrderProcessing = true
    console.log('✅ bgManage页面隐藏完成，启用全局后台处理')
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    console.log('💥 ===== bgManage页面卸载 =====');
    this.stopOrderMonitoring()
    this.stopAutoShipping()
    
    // 正确移除蓝牙连接状态监听器（只移除我们设置的那个）
    if (this.bluetoothStateChangeHandler) {
      console.log('🔌 移除蓝牙连接状态监听器');
      wx.offBLEConnectionStateChange(this.bluetoothStateChangeHandler);
      this.bluetoothStateChangeHandler = null;
      console.log('✅ 蓝牙监听器已移除');
    } else {
      console.log('⚠️ 没有蓝牙监听器需要移除');
    }
    
    // 启用全局后台处理
    app.globalData.backgroundOrderProcessing = true
    console.log('✅ bgManage页面卸载完成，启用全局后台处理')
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.resetOrderPagination()
    this.loadOrderPage()
    setTimeout(function () {
      wx.stopPullDownRefresh()
    }, 500)
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    this.loadOrderPage()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  // 清空所有打印机存储数据（调试用）
  clearAllPrinterData() {
    console.log('🧹 清空所有打印机存储数据...');
    
    // 清空新的双打印机存储
    wx.removeStorageSync('fruitPrinterCharacteristic');
    wx.removeStorageSync('fruitPrinterDevice');
    wx.removeStorageSync('boxlunchPrinterCharacteristic');
    wx.removeStorageSync('boxlunchPrinterDevice');
    
    // 清空旧的单打印机存储
    wx.removeStorageSync('printerCharacteristic');
    
    // 重置页面数据
    this.setData({
      'fruitPrinter.connectedDevice': null,
      'fruitPrinter.characteristic': null,
      'boxlunchPrinter.connectedDevice': null,
      'boxlunchPrinter.characteristic': null,
      connectedDevice: null
    });
    
    wx.showToast({
      title: '打印机数据已清空',
      icon: 'success'
    });
    
    console.log('✅ 所有打印机存储数据已清空');
  },

  // 测试智能打印功能
  testSmartPrinting() {
    console.log('🧠 开始测试智能打印功能');
    
    // 检查当前连接的打印机类型
    const fruitConnected = this.data.fruitPrinter.connectedDevice;
    const boxlunchConnected = this.data.boxlunchPrinter.connectedDevice;
    
    let printerStatus = '';
    if (fruitConnected) {
      printerStatus = '当前连接：🍎 水果打印机';
    } else if (boxlunchConnected) {
      printerStatus = '当前连接：🍱 盒饭打印机';
    } else {
      printerStatus = '当前未连接任何打印机';
    }
    
    // 创建测试订单数据
    const testOrders = [
      {
        _id: 'test_fruit_001',
        orderItems: [
          { name: '苹果', category: '水果', quantity: 2, price: 10 },
          { name: '香蕉', category: '水果', quantity: 1, price: 8 }
        ],
        totalAmount: 28,
        orderTime: new Date().toISOString(),
        description: '纯水果订单测试'
      },
      {
        _id: 'test_boxlunch_001', 
        orderItems: [
          { name: '红烧肉饭', category: '盒饭', quantity: 1, price: 15 },
          { name: '宫保鸡丁饭', category: '盒饭', quantity: 2, price: 12 }
        ],
        totalAmount: 39,
        orderTime: new Date().toISOString(),
        description: '纯盒饭订单测试'
      },
      {
        _id: 'test_mixed_001',
        orderItems: [
          { name: '苹果', category: '水果', quantity: 1, price: 5 },
          { name: '红烧肉饭', category: '盒饭', quantity: 1, price: 15 },
          { name: '香蕉', category: '水果', quantity: 2, price: 8 }
        ],
        totalAmount: 28,
        orderTime: new Date().toISOString(),
        description: '混合订单测试'
      }
    ];

    // 根据连接的打印机类型显示不同的测试选项
    let itemList = [];
    let expectedResults = [];
    
    if (fruitConnected) {
      itemList = [
        '测试纯水果订单 ✅',
        '测试纯盒饭订单 🔄',
        '测试混合订单 🔄',
        '测试所有订单类型'
      ];
      expectedResults = [
        '✅ 应该成功打印',
        '🔄 应该跳过处理（静默）',
        '🔄 应该跳过处理（静默）',
        '测试所有情况'
      ];
    } else if (boxlunchConnected) {
       itemList = [
         '测试纯水果订单 🔄',
         '测试纯盒饭订单 ✅',
         '测试混合订单 ✅',
         '测试所有订单类型'
       ];
       expectedResults = [
         '🔄 应该跳过处理（静默）',
         '✅ 应该成功打印',
         '✅ 应该成功打印',
         '测试所有情况'
       ];
    } else {
      wx.showToast({
        title: '请先连接打印机',
        icon: 'none'
      });
      return;
    }

    // 显示测试选项
    wx.showModal({
      title: '智能打印测试',
      content: `${printerStatus}\n\n选择要测试的订单类型：`,
      showCancel: true,
      confirmText: '开始测试',
      success: (res) => {
        if (res.confirm) {
          wx.showActionSheet({
            itemList: itemList,
            success: (res) => {
              console.log(`用户选择测试选项: ${res.tapIndex}`);
              console.log(`预期结果: ${expectedResults[res.tapIndex]}`);
              
              if (res.tapIndex === 3) {
                // 测试所有订单类型
                testOrders.forEach((order, index) => {
                  setTimeout(() => {
                    console.log(`\n🧪 测试订单 ${index + 1}: ${order.description}`);
                    console.log(`预期结果: ${expectedResults[index]}`);
                    this.smartPrintOrder(order);
                  }, index * 3000); // 每个订单间隔3秒
                });
              } else {
                // 测试单个订单类型
                const selectedOrder = testOrders[res.tapIndex];
                console.log(`\n🧪 测试订单: ${selectedOrder.description}`);
                console.log(`预期结果: ${expectedResults[res.tapIndex]}`);
                this.smartPrintOrder(selectedOrder);
              }
            },
            fail: (err) => {
              console.log('用户取消测试');
            }
          });
        }
      }
    });
  }
})