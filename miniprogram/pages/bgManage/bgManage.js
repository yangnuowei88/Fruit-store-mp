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
    // 模拟打印机相关
    mockPrinterConnected: false,
    mockPrinterDevice: null,
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
    // 初始化正在打印的订单ID集合
    this.printingOrders = new Set()
    
    this.getAllList()
    this.initBluetooth()
    this.checkMockPrinterStatus()
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
    // 更新显示列表
    this.updateDisplayList()
  },
  tapTo2: function () { //修改和删除
    var that = this
    that.setData({
      cardNum: 2
    })
    // 切换到其他标签页时清空搜索状态
    this.clearSearchState()
    // 更新显示列表
    this.updateDisplayList()
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
    this.updateDisplayList()
  },
  tapTo4: function () {
    var that = this
    that.setData({
      cardNum: 4,
      displayOrderList: this.data.allOrderList // 显示所有订单
    })
    // 在所有订单标签页，根据搜索状态更新显示
    this.updateDisplayList()
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
      sending: true,      // 确保配送状态为true
      sendingTime: app.CurrentTime_show()
    }, e => {
      that.getAllList()
      wx.showToast({
        title: '【已发货】',
      })
    })
  },

  // 确认送达
  confirmDelivery: function(e) {
    var that = this
    console.log('确认送达订单ID:', e.currentTarget.id)
    app.updateInfo('order_master', e.currentTarget.id, {
      finished: true,     // 设置完成状态为true
      finishedTime: app.CurrentTime_show()
    }, e => {
      that.getAllList()
      wx.showToast({
        title: '【已送达】',
      })
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

  // 连接模拟打印机
  connectMockPrinter() {
    console.log('🖨️ 连接模拟打印机...');
    
    // 创建模拟打印机设备信息
    const mockPrinterDevice = {
      deviceId: 'MOCK_PRINTER_' + Date.now(),
      name: '模拟热敏打印机',
      serviceId: 'MOCK_SERVICE_ID',
      characteristicId: 'MOCK_CHARACTERISTIC_ID',
      connected: true,
      mockDevice: true  // 标记为模拟设备
    };

    // 更新页面数据
    this.setData({
      mockPrinterConnected: true,
      mockPrinterDevice: mockPrinterDevice
    });

    // 将模拟打印机信息保存到本地存储
    wx.setStorageSync('printerCharacteristic', mockPrinterDevice);
    
    console.log('✅ 模拟打印机连接成功:', mockPrinterDevice);
    
    wx.showToast({
      title: '模拟打印机已连接',
      icon: 'success'
    });
  },

  // 断开模拟打印机
  disconnectMockPrinter() {
    console.log('🖨️ 断开模拟打印机...');
    
    // 更新页面数据
    this.setData({
      mockPrinterConnected: false,
      mockPrinterDevice: null
    });

    // 清除本地存储中的打印机信息
    wx.removeStorageSync('printerCharacteristic');
    
    console.log('✅ 模拟打印机已断开');
    
    wx.showToast({
      title: '模拟打印机已断开',
      icon: 'success'
    });
  },

  // 检查模拟打印机连接状态
  checkMockPrinterStatus() {
    const characteristic = wx.getStorageSync('printerCharacteristic');
    if (characteristic && characteristic.mockDevice === true) {
      console.log('🖨️ 检测到已连接的模拟打印机:', characteristic);
      this.setData({
        mockPrinterConnected: true,
        mockPrinterDevice: characteristic
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
        
        // 更新订单打印状态到数据库
        app.updateInfo('order_master', orderData._id, {
          printed: true,
          printTime: app.CurrentTime_show()
        }, () => {
          console.log(`📝 订单 ${orderData._id} 打印状态已更新到数据库`);
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

    console.log(`开始分包发送，总长度: ${data.length}, 分包数: ${totalChunks}, 每包大小: ${chunkSize}`);

    const sendNextChunk = () => {
      if (currentChunk >= totalChunks) {
        console.log('所有数据包发送完成');
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
      // 打印机未连接时直接发货
      this.updateOrderToShipping(orderData._id);
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
            // 重连失败也要发货
            this.updateOrderToShipping(orderData._id)
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
      app.updateInfo('order_master', orderData._id, {
        printed: true,
        printTime: app.CurrentTime_show()
      }, () => {
        console.log(`📝 订单 ${orderData._id} 打印状态已更新`);
        // 打印成功后自动发货
        this.updateOrderToShipping(orderData._id);
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
      // 打印失败也要发货
      this.updateOrderToShipping(orderData._id);
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
    content += `收货地址: ${order.schoolName}/${order.addressItem}/${order.detail}\n`;
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
    content += `订单总价: ¥${order.total}\n`;
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
      // 使用与检查新订单相同的过滤条件
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      );
      that.setData({
        lastOrderCount: paidOrders.length
      });
      console.log(`初始订单数量: ${paidOrders.length}`);
    });
  },

  // 检查新订单
  checkNewOrders() {
    const that = this;
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      // 过滤条件：已支付、未发货、未打印或打印失败的订单
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      );
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
      // 如果不自动打印，直接发货
      this.updateOrderToShipping(order._id);
    }
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
    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (!characteristic) {
      return false
    }
    
    // 如果是模拟设备，直接返回连接状态
    if (characteristic.mockDevice === true) {
      console.log('🖨️ 检测到模拟打印机，返回连接状态: true')
      return true
    }
    
    // 真实设备的连接检查
    return characteristic && characteristic.deviceId
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

    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (!characteristic) {
      console.log('打印机未连接，跳过打印')
      this.updateOrderToShipping(order._id)
      return
    }

    // 先检查蓝牙连接状态
    this.checkBluetoothConnection(characteristic, (isConnected) => {
      if (!isConnected) {
        console.log('🔄 蓝牙连接已断开，尝试重连...')
        this.attemptReconnectBluetooth(characteristic, (reconnected) => {
          if (reconnected) {
            console.log('✅ 蓝牙重连成功，继续打印')
            this.executeAutoPrint(order, characteristic)
          } else {
            console.log('❌ 蓝牙重连失败，跳过打印')
            this.updateOrderToShipping(order._id)
          }
        })
      } else {
        console.log('✅ 蓝牙连接正常，开始自动打印')
        this.executeAutoPrint(order, characteristic)
      }
    })
  },

  // 执行自动打印操作
  executeAutoPrint(order, characteristic) {
    console.log(`🤖 ===== 开始执行自动打印 =====`);
    console.log(`📋 订单ID: ${order._id}`);
    console.log(`🖨️ 打印机特征值: ${JSON.stringify(characteristic)}`);
    
    // 检查是否正在打印
    if (this.printingOrders.has(order._id)) {
      console.log(`⚠️ 订单 ${order._id} 正在打印中，跳过重复自动打印`);
      return;
    }

    try {
      // 添加到打印锁定集合（本地和全局）
      this.printingOrders.add(order._id);
      app.globalData.printingOrders.add(order._id);
      console.log(`🔒 订单 ${order._id} 已加入自动打印锁定`);

      // 如果是模拟设备，执行模拟打印
      if (characteristic.mockDevice === true) {
        console.log(`🖨️ 执行模拟打印 - 订单 ${order._id}`);
        console.log(`🎭 ===== 模拟打印内容 =====`);
        console.log(`📋 订单ID: ${order._id}`);
        console.log(`📄 订单号: ${order.orderNumber || '无'}`);
        console.log(`🎯 订单场景: ${order.scenario || '普通订单'}`);
        console.log(`👤 客户姓名: ${order.name}`);
        console.log(`📞 联系电话: ${order.phone}`);
        console.log(`🏫 学校名称: ${order.schoolName}`);
        console.log(`📍 地址类型: ${order.addressItem}`);
        console.log(`🏠 详细地址: ${order.detail}`);
        console.log(`📍 完整收货地址: ${order.schoolName}/${order.addressItem}/${order.detail}`);
        console.log(`💰 订单总价: ¥${order.total}`);
        console.log(`💬 配送备注: ${order.message || '无'}`);
        console.log(`⏰ 下单时间: ${order.orderTime}`);
        console.log(`💳 支付时间: ${order.payTime || '未支付'}`);
        console.log(`📦 支付状态: ${order.paySuccess ? '已支付' : '未支付'}`);
        console.log(`🚚 发货状态: ${order.sending ? '已发货' : '待发货'}`);
        console.log(`✅ 完成状态: ${order.finished ? '已完成' : '未完成'}`);
        console.log(`🖨️ 打印状态: ${order.printed ? '已打印' : '未打印'}`);
        console.log(`--------------------------------`);
        if (order.fruitList && order.fruitList.length > 0) {
          console.log(`🍎 订单商品清单:`);
          let itemTotal = 0;
          order.fruitList.forEach((fruit, index) => {
            const itemSubtotal = fruit[1] * fruit[2];
            itemTotal += itemSubtotal;
            console.log(`   ${index + 1}. ${fruit[0]} × ${fruit[1]} = ¥${itemSubtotal.toFixed(2)}`);
            console.log(`      单价: ¥${fruit[2]}/份`);
          });
          console.log(`   商品小计: ¥${itemTotal.toFixed(2)}`);
        }
        console.log(`--------------------------------`);
        console.log(`💰 订单总计: ¥${order.total}`);
        console.log(`🎭 ===== 模拟打印完成 =====`);
        
        // 模拟打印过程（1秒延迟）
        setTimeout(() => {
          console.log(`✅ 订单 ${order._id} 模拟打印成功`)
          console.log(`🎉 ===== 自动打印（模拟）成功完成 =====`);
          
          // 从打印锁定集合中移除（本地和全局）
          this.printingOrders.delete(order._id);
          app.globalData.printingOrders.delete(order._id);
          console.log(`🔓 订单 ${order._id} 已从模拟打印锁定中移除`);
          
          // 更新订单打印状态
          app.updateInfo('order_master', order._id, {
            printed: true,
            printTime: app.CurrentTime_show()
          }, () => {
            console.log(`📝 订单 ${order._id} 模拟打印状态已更新`)
            // 打印成功后自动发货
            this.updateOrderToShipping(order._id)
          })
        }, 1000);
        
        return;
      }

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
        console.log(`✅ 订单 ${order._id} 自动打印成功`)
        console.log(`🎉 ===== 自动打印成功完成 =====`);
        
        // 从打印锁定集合中移除（本地和全局）
        this.printingOrders.delete(order._id);
        app.globalData.printingOrders.delete(order._id);
        console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除`);
        
        // 更新订单打印状态
        app.updateInfo('order_master', order._id, {
          printed: true,
          printTime: app.CurrentTime_show()
        }, () => {
          console.log(`📝 订单 ${order._id} 打印状态已更新`)
          // 打印成功后自动发货
          this.updateOrderToShipping(order._id)
        })
      }, (err) => {
        console.error(`❌ 订单 ${order._id} 自动打印失败:`, err)
        console.log(`💥 ===== 自动打印失败 =====`);
        
        // 从打印锁定集合中移除（本地和全局）
        this.printingOrders.delete(order._id);
        app.globalData.printingOrders.delete(order._id);
        console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除（失败）`);
        
        // 打印失败也要发货，避免订单积压
        this.updateOrderToShipping(order._id)
      })
    } catch (error) {
      console.error(`自动打印订单 ${order._id} 过程出错:`, error)
      console.log(`💥 ===== 自动打印出错 =====`);
      
      // 从打印锁定集合中移除（本地和全局）
      this.printingOrders.delete(order._id);
      app.globalData.printingOrders.delete(order._id);
      console.log(`🔓 订单 ${order._id} 已从自动打印锁定中移除（出错）`);
      
      // 出错也要发货，避免订单积压
      this.updateOrderToShipping(order._id)
    }
  },

  // 检查蓝牙连接状态
  checkBluetoothConnection(characteristic, callback) {
    if (!characteristic || !characteristic.deviceId) {
      callback(false)
      return
    }

    // 如果是模拟设备，直接返回连接成功
    if (characteristic.mockDevice === true) {
      console.log('🖨️ 模拟打印机连接检查 - 返回连接成功')
      callback(true)
      return
    }

    // 真实设备的蓝牙连接检查
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
    
    // 获取所有订单数据
    app.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      console.log('获取所有订单数据:', e.data)
      
      // 存储所有订单
      const allOrders = e.data || [];
      
      // 筛选待发货订单：已支付但未发货未完成的订单
      const pendingOrders = allOrders.filter(order => {
        return order.paySuccess === true && 
               order.sending !== true && 
               order.finished !== true;
      });
      
      // 筛选配送中订单：已发货但未完成的订单
      const shippingOrders = allOrders.filter(order => {
        return order.sending === true && order.finished !== true;
      });
      
      // 按发货时间排序（如果有的话），否则按订单时间排序
      shippingOrders.sort((a, b) => {
        const timeA = a.sendingTime || a.orderTime;
        const timeB = b.sendingTime || b.orderTime;
        return new Date(timeB) - new Date(timeA);
      });
      
      // 筛选已完成订单：已完成的订单
      const completedOrders = allOrders.filter(order => {
        return order.finished === true;
      });
      
      // 按完成时间排序（如果有的话），否则按订单时间排序
      completedOrders.sort((a, b) => {
        const timeA = a.finishedTime || a.orderTime;
        const timeB = b.finishedTime || b.orderTime;
        return new Date(timeB) - new Date(timeA);
      });
      
      that.setData({
        allOrderList: allOrders,        // 所有订单
        orderList: pendingOrders,       // 待发货订单
        sendingList: shippingOrders,    // 配送中订单
        finishedList: completedOrders,  // 已完成订单
        displayOrderList: pendingOrders // 默认显示待发货订单
      })
      
      console.log('所有订单数量:', allOrders.length)
      console.log('待发货订单:', pendingOrders.length)
      console.log('配送中订单:', shippingOrders.length)
      console.log('已完成订单:', completedOrders.length)
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
    
    // 检查并显示打印机连接状态
    this.checkPrinterConnectionStatus()
    
    this.startOrderMonitoring()
    this.startAutoShipping() // 启动自动发货检查
    
    // 通知全局停止后台处理，页面接管
    app.globalData.backgroundOrderProcessing = false
    console.log('📱 bgManage页面显示，接管订单处理')
  },

  // 检查打印机连接状态
  checkPrinterConnectionStatus() {
    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (characteristic) {
      if (characteristic.mockDevice === true) {
        // 模拟打印机
        console.log('🖨️ 检测到模拟打印机连接')
        this.setData({
          connectedDevice: {
            name: characteristic.name || '模拟热敏打印机',
            deviceId: characteristic.deviceId,
            mockDevice: true
          }
        })
      } else {
        // 真实打印机
        this.setData({
          connectedDevice: {
            name: characteristic.name || '蓝牙打印机',
            deviceId: characteristic.deviceId,
            mockDevice: false
          }
        })
      }
    } else {
      this.setData({
        connectedDevice: null
      })
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    this.stopOrderMonitoring()
    this.stopAutoShipping()
    
    // 启用全局后台处理
    app.globalData.backgroundOrderProcessing = true
    console.log('🔄 bgManage页面隐藏，启用全局后台处理')
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.stopOrderMonitoring()
    this.stopAutoShipping()
    
    // 启用全局后台处理
    app.globalData.backgroundOrderProcessing = true
    console.log('🔄 bgManage页面卸载，启用全局后台处理')
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