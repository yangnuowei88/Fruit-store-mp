const app = getApp()

Page({
  data: {
    orderList:{},
    sendingList:{},
    finishedList:{},
    cardNum: 1,
    // 蓝牙打印机相关
    bluetoothEnabled: false,
    bluetoothDevices: [],
    connectedDevice: null,
    isConnecting: false,
    showBluetoothModal: false,
    // 新订单提醒
    lastOrderCount: 0,
    orderCheckInterval: null,
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
  tapTo4: function () {
    var that = this
    that.setData({
      cardNum: 4
    })
  },

  // ----------------------!!!  订单管理  !!!----------------------
  // 已支付-发货
  boxFruit: function(e) {
    var that = this
    const orderId = e.currentTarget.id;
    const orderData = that.data.orderList.find(order => order._id === orderId);
    
    // 询问是否打印订单
    wx.showModal({
      title: '发货确认',
      content: '是否需要打印订单？',
      confirmText: '打印并发货',
      cancelText: '直接发货',
      success: (res) => {
        if (res.confirm && orderData) {
          // 打印订单
          that.printOrder(orderData);
        }
        
        // 更新订单状态为已发货
        app.updateInfo('order_master', orderId, {
          sending: true,
          sendingTime: app.CurrentTime_show()
        }, e => {
          that.getAllList()
          wx.showToast({
            title: '【已发货】',
          })
        })
      }
    });
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

  // 打印订单
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
    });
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

  // 获取所有订单信息
  getAllList:function(){
    var that = this
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      that.setData({
        orderList: e.data
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
    this.stopOrderMonitoring();
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