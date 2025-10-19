const app = getApp()

Page({
  data: {
    orderList: [],
    sendingList: [],
    finishedList: [],
    displayOrderList: [], // 用于显示的订单列表（原始数据或搜索结果）
    cardNum: 1,
    // 搜索相关
    searchPhone: '',
    searchResult: [],
    showNoResult: false,
    // 蓝牙打印机相关
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
    this.getAllList()
    this.initBluetooth()
    this.startOrderMonitoring()
  },

  // --------------------!!!  选项卡切换  !!!----------------------
  tapTo1: function () {  //添加
    var that = this
    that.setData({
      cardNum: 1
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
  },
  tapTo2: function () { //修改和删除
    var that = this
    that.setData({
      cardNum: 2
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
    // console.log(getCurrentPages())
  },
  tapTo3: function () {
    var that = this
    that.setData({
      cardNum: 3
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
  },
  tapTo4: function () {
    var that = this
    that.setData({
      cardNum: 4
    })
    // 在所有订单标签页，根据搜索状态更新显示
    this.updateDisplayList()
  },

  // 更新显示列表（根据是否有搜索结果）
  updateDisplayList: function() {
    const displayList = this.data.searchResult.length > 0 ? this.data.searchResult : this.data.orderList
    this.setData({
      displayOrderList: displayList
    })
  },

  // 清空搜索状态（用于切换标签页时）
  clearSearchState: function() {
    this.setData({
      searchPhone: '',
      searchResult: [],
      displayOrderList: this.data.orderList,
      showNoResult: false
    })
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
            // 打印订单
            console.log('用户选择打印订单');
            that.printOrderWithStatus(orderData);
          } else {
            console.log('用户选择直接发货');
            that.updateOrderToShipping(orderId);
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
    console.log(e.currentTarget.id)
    app.updateInfo('order_master', e.currentTarget.id, {
      finished: true,
      finishedTime: app.CurrentTime_show()
    }, e => {
      that.getAllList()
      wx.showToast({
        title: '【已送达】',
      })
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

    // 格式化打印内容
    const printContent = this.formatOrderForPrint(orderData);
    
    // 转换为打印机可识别的格式
    const buffer = this.stringToArrayBuffer(printContent);

    wx.writeBLECharacteristicValue({
      deviceId: characteristic.deviceId,
      serviceId: characteristic.serviceId,
      characteristicId: characteristic.characteristicId,
      value: buffer,
      success: function() {
        wx.showToast({
          title: '打印成功',
          icon: 'success'
        });
      },
      fail: function(err) {
        console.log('打印失败', err);
        wx.showToast({
          title: '打印失败',
          icon: 'none'
        });
      }
    });
  },

  // 手动打印订单并记录状态
  printOrderWithStatus(orderData) {
    const characteristic = wx.getStorageSync('printerCharacteristic');
    if (!characteristic) {
      wx.showToast({
        title: '请先连接打印机',
        icon: 'none'
      });
      // 打印机未连接时直接发货
      this.updateOrderToShipping(orderData._id);
      return;
    }

    // 格式化打印内容
    const printContent = this.formatOrderForPrint(orderData);
    const buffer = this.stringToArrayBuffer(printContent);

    wx.writeBLECharacteristicValue({
      deviceId: characteristic.deviceId,
      serviceId: characteristic.serviceId,
      characteristicId: characteristic.characteristicId,
      value: buffer,
      success: () => {
        console.log(`✅ 手动打印订单 ${orderData._id} 成功`);
        wx.showToast({
          title: '打印成功',
          icon: 'success'
        });
        
        // 更新订单打印状态
        app.updateInfo('order_master', orderData._id, {
          printed: true,
          printTime: app.CurrentTime_show()
        }, () => {
          console.log(`📝 订单 ${orderData._id} 打印状态已更新`);
          // 打印成功后自动发货
          this.updateOrderToShipping(orderData._id);
        });
      },
      fail: (err) => {
        console.error(`❌ 手动打印订单 ${orderData._id} 失败:`, err);
        wx.showToast({
          title: '打印失败',
          icon: 'none'
        });
        // 打印失败也要发货
        this.updateOrderToShipping(orderData._id);
      }
    });
  },

  // 格式化订单打印内容
  formatOrderForPrint(order) {
    let content = '';
    content += '================================\n';
    content += '          订单详情\n';
    content += '================================\n';
    content += `客户姓名: ${order.name}\n`;
    content += `联系电话: ${order.phone}\n`;
    content += `收货地址: ${order.schoolName}/${order.addressItem}/${order.detail}\n`;
    content += '--------------------------------\n';
    content += '订单内容:\n';
    
    if (order.fruitList && order.fruitList.length > 0) {
      order.fruitList.forEach(fruit => {
        content += `${fruit[0]} × ${fruit[1]}\n`;
      });
    }
    
    content += '--------------------------------\n';
    content += `订单总价: ¥${order.total}\n`;
    content += `备注信息: ${order.message || '无'}\n`;
    content += `下单时间: ${order.orderTime}\n`;
    content += '================================\n';
    content += '\n\n\n'; // 打印后换行
    
    return content;
  },

  // 字符串转ArrayBuffer
  stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
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
    // 每30秒检查一次新订单
    that.data.orderCheckInterval = setInterval(() => {
      that.checkNewOrders();
    }, 30000);
    
    // 初始化订单数量
    that.getInitialOrderCount();
  },

  // 获取初始订单数量
  getInitialOrderCount() {
    const that = this;
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      const paidOrders = e.data.filter(order => order.paySuccess && !order.sending);
      that.setData({
        lastOrderCount: paidOrders.length
      });
    });
  },

  // 检查新订单
  checkNewOrders() {
    const that = this;
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      const paidOrders = e.data.filter(order => order.paySuccess && !order.sending);
      const currentOrderCount = paidOrders.length;
      
      if (currentOrderCount > that.data.lastOrderCount) {
        // 有新订单
        const newOrdersCount = currentOrderCount - that.data.lastOrderCount;
        that.showNewOrderNotification(newOrdersCount, paidOrders[0]);
        
        // 更新订单数量
        that.setData({
          lastOrderCount: currentOrderCount
        });
        
        // 刷新订单列表
        that.getAllList();
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
    
    // 弹窗提醒
    wx.showModal({
      title: '新订单提醒',
      content: `您有${count}个新订单！\n客户：${latestOrder.name}\n金额：¥${latestOrder.total}`,
      confirmText: '查看订单',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          // 切换到已支付订单页面
          this.setData({
            cardNum: 1
          });
        }
      }
    });
  },

  // 停止订单监听
  stopOrderMonitoring() {
    if (this.data.orderCheckInterval) {
      clearInterval(this.data.orderCheckInterval);
      this.setData({
        orderCheckInterval: null
      });
    }
  },

  // 启动自动发货检查
  startAutoShipping() {
    if (!this.data.autoShippingEnabled) {
      console.log('自动发货功能已禁用')
      return
    }

    console.log('启动自动发货检查...')
    
    // 立即执行一次检查
    this.checkPendingOrders()
    
    // 每30秒检查一次待发货订单
    const interval = setInterval(() => {
      this.checkPendingOrders()
    }, 30000)
    
    this.setData({
      autoShippingInterval: interval
    })
  },

  // 停止自动发货检查
  stopAutoShipping() {
    if (this.data.autoShippingInterval) {
      clearInterval(this.data.autoShippingInterval)
      this.setData({
        autoShippingInterval: null
      })
      console.log('已停止自动发货检查')
    }
  },

  // 检查待发货订单
  checkPendingOrders() {
    console.log('🔍 检查待发货订单...')
    
    app.getInfoByOrder('order_master', 'orderTime', 'desc', (orders) => {
      if (!orders || orders.length === 0) {
        console.log('没有找到订单数据')
        return
      }

      // 筛选出已支付但未发货的订单
      const pendingOrders = orders.filter(order => 
        order.paySuccess === true && 
        order.sending !== true &&
        order.finished !== true
      )

      console.log(`找到 ${pendingOrders.length} 个待发货订单`)

      if (pendingOrders.length > 0) {
        pendingOrders.forEach(order => {
          this.processAutoShipping(order)
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
    const characteristic = wx.getStorageSync('printerCharacteristic')
    return characteristic && characteristic.deviceId
  },

  // 自动打印订单
  autoPrintOrder(order) {
    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (!characteristic) {
      console.log('打印机未连接，跳过打印')
      this.updateOrderToShipping(order._id)
      return
    }

    // 格式化打印内容
    const printContent = this.formatOrderForPrint(order)
    const buffer = this.stringToArrayBuffer(printContent)

    wx.writeBLECharacteristicValue({
      deviceId: characteristic.deviceId,
      serviceId: characteristic.serviceId,
      characteristicId: characteristic.characteristicId,
      value: buffer,
      success: () => {
        console.log(`✅ 订单 ${order._id} 打印成功`)
        
        // 更新订单打印状态
        app.updateInfo('order_master', order._id, {
          printed: true,
          printTime: app.CurrentTime_show()
        }, () => {
          console.log(`📝 订单 ${order._id} 打印状态已更新`)
          // 打印成功后自动发货
          this.updateOrderToShipping(order._id)
        })
      },
      fail: (err) => {
        console.error(`❌ 订单 ${order._id} 打印失败:`, err)
        // 打印失败也要发货，避免订单积压
        this.updateOrderToShipping(order._id)
      }
    })
  },

  // 更新订单为发货状态
  updateOrderToShipping(orderId) {
    console.log(`🚚 更新订单 ${orderId} 为发货状态`)
    
    app.updateInfo('order_master', orderId, {
      sending: true,
      sendingTime: app.CurrentTime_show()
    }, () => {
      console.log(`✅ 订单 ${orderId} 已自动发货`)
      
      // 刷新订单列表
      this.getAllList()
      
      // 显示提示（可选，避免过于频繁的提示）
      // wx.showToast({
      //   title: '订单已自动发货',
      //   icon: 'success',
      //   duration: 1000
      // })
    })
  },

  // 获取所有订单信息
  getAllList:function(){
    var that = this
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      that.setData({
        orderList: e.data,
        displayOrderList: e.data // 初始显示所有订单
      })
      console.log(e.data)
    })
    app.getInfoByOrder('order_master', 'sendingTime', 'desc', e => {
      that.setData({
        sendingList: e.data
      })
    })
    app.getInfoByOrder('order_master', 'finishedTime', 'desc', e => {
      that.setData({
        finishedList: e.data
      })
    })
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
    this.getAllList()
    this.getInitialOrderCount()
    this.startOrderMonitoring()
    this.startAutoShipping() // 启动自动发货检查
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    this.stopOrderMonitoring()
    this.stopAutoShipping()
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.stopOrderMonitoring()
    this.stopAutoShipping()
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

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

  }
})