//app.js
const gbkEncoder = require('./utils/gbkEncoder.js')

App({
  onLaunch: function () {
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-2gmg1o6h43977608',
        traceUser: true,
      })
    }

    this.globalData = {
      cloudRoot : "cloud://cloud1-0g8wog310bb3f1a1/",
      carts:[],  //购物车
      tmpNum: 0,
      tempFilePaths: "",
      admin:["Mr.Voyz"],
      openId: null,
      // 开发模式配置
      developmentMode: false,  // 开发阶段设为true，生产环境设为false
      // 微信支付配置（需要替换为真实配置）
      appid: 'wx7c3ad96751b729b4',
      mch_id: '1730060902',
      apikey: 'e50c2e0abfa604634745f99c71406965',
      offLine:false,
      school_Arr: [
        "交大",
        "华师大"
      ],
      address_Arr: [
        "宿舍楼", "学院", "图书馆", "餐厅", "教学楼", "其他"
      ],
      // 全局订单监听相关
      globalOrderCheckInterval: null,
      lastGlobalOrderCount: 0,
      backgroundOrderProcessing: true // 是否启用后台订单处理
    }
    
    // 初始化正在打印的订单ID集合（Set对象不能放在globalData中）
    this.globalData.printingOrders = new Set()
  },

  // 小程序显示时
  onShow: function() {
    console.log('🔄 小程序显示，启动全局订单监听')
    this.startGlobalOrderMonitoring()
  },

  // 小程序隐藏时
  onHide: function() {
    console.log('⏸️ 小程序隐藏，保持后台订单监听')
    // 不停止监听，保持后台运行
  },

  // 启动全局订单监听
  startGlobalOrderMonitoring() {
    if (this.globalData.globalOrderCheckInterval) {
      clearInterval(this.globalData.globalOrderCheckInterval)
    }
    
    // 初始化订单数量
    this.getGlobalInitialOrderCount()
    
    // 每30秒检查一次新订单
    this.globalData.globalOrderCheckInterval = setInterval(() => {
      this.checkGlobalNewOrders()
    }, 30000)
  },

  // 停止全局订单监听
  stopGlobalOrderMonitoring() {
    if (this.globalData.globalOrderCheckInterval) {
      clearInterval(this.globalData.globalOrderCheckInterval)
      this.globalData.globalOrderCheckInterval = null
    }
  },

  // 获取初始订单数量
  getGlobalInitialOrderCount() {
    const that = this
    this.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      // 使用与检查新订单相同的过滤条件
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      )
      that.globalData.lastGlobalOrderCount = paidOrders.length
      console.log(`📊 初始化全局订单数量: ${paidOrders.length}`)
    })
  },

  // 检查全局新订单
  checkGlobalNewOrders() {
    if (!this.globalData.backgroundOrderProcessing) return
    
    const that = this
    this.getInfoByOrder('order_master', 'orderTime', 'desc', e => {
      // 过滤条件：已支付、未发货、未打印或打印失败的订单
      const paidOrders = e.data.filter(order => 
        order.paySuccess && 
        !order.sending && 
        (!order.printed || order.printed !== true)
      )
      const currentOrderCount = paidOrders.length
      
      if (currentOrderCount > that.globalData.lastGlobalOrderCount) {
        const newOrdersCount = currentOrderCount - that.globalData.lastGlobalOrderCount
        console.log(`🆕 检测到 ${newOrdersCount} 个新订单`)
        
        // 处理新订单
        that.processGlobalNewOrders(newOrdersCount, paidOrders)
        
        // 更新订单数量
        that.globalData.lastGlobalOrderCount = currentOrderCount
      }
    })
  },

  // 处理全局新订单
  processGlobalNewOrders(count, paidOrders) {
    console.log(`🔄 全局处理 ${count} 个新订单`)
    
    // 震动提醒
    wx.vibrateShort()
    
    // 处理每个新订单
    paidOrders.slice(0, count).forEach((order, index) => {
      setTimeout(() => {
        this.processGlobalNewOrder(order)
      }, index * 1000)
    })
  },

  // 处理单个全局新订单
  processGlobalNewOrder(order) {
    console.log(`🆕 全局处理新订单: ${order._id}`)
    
    // 自动打印和发货
    this.autoProcessOrder(order)
  },

  // 自动处理订单（打印+发货）
  autoProcessOrder(order) {
    const characteristic = wx.getStorageSync('printerCharacteristic')
    
    if (characteristic && characteristic.deviceId) {
      // 有打印机连接，先打印再发货
      this.autoPrintGlobalOrder(order)
    } else {
      // 没有打印机，直接发货
      console.log(`📦 订单 ${order._id} 无打印机连接，直接发货`)
      this.updateGlobalOrderToShipping(order._id)
    }
  },

  // 全局自动打印订单
  autoPrintGlobalOrder(order) {
    // 检查是否已经在打印中
    if (this.globalData.printingOrders.has(order._id)) {
      console.log(`⚠️ 订单 ${order._id} 正在打印中，跳过重复打印`)
      return
    }

    // 检查订单是否已经打印过
    if (order.printed === true) {
      console.log(`✅ 订单 ${order._id} 已打印过，直接发货`)
      this.updateGlobalOrderToShipping(order._id)
      return
    }

    const characteristic = wx.getStorageSync('printerCharacteristic')
    if (!characteristic) {
      console.log('打印机未连接，跳过打印')
      this.updateGlobalOrderToShipping(order._id)
      return
    }

    // 添加到打印锁定集合
    this.globalData.printingOrders.add(order._id)
    console.log(`🔒 订单 ${order._id} 加入打印队列`)

    // 先检查蓝牙连接状态
    this.checkBluetoothConnection(characteristic, (isConnected) => {
      if (!isConnected) {
        console.log('🔄 蓝牙连接已断开，尝试重连...')
        this.attemptReconnectBluetooth(characteristic, (reconnected) => {
          if (reconnected) {
            console.log('✅ 蓝牙重连成功，继续打印')
            this.executePrint(order, characteristic)
          } else {
            console.log('❌ 蓝牙重连失败，跳过打印')
            // 移除打印锁定
            this.globalData.printingOrders.delete(order._id)
            this.updateGlobalOrderToShipping(order._id)
          }
        })
      } else {
        console.log('✅ 蓝牙连接正常，开始打印')
        this.executePrint(order, characteristic)
      }
    })
  },

  // 执行打印操作
  executePrint(order, characteristic) {
    console.log(`🌐 ===== 开始执行全局打印 =====`);
    console.log(`📋 订单ID: ${order._id}`);
    console.log(`🖨️ 打印机特征值: ${JSON.stringify(characteristic)}`);
    
    try {
      console.log(`🖨️ 开始打印订单 ${order._id}`)
      
      // 格式化打印内容
      console.log(`📄 正在格式化全局打印内容...`);
      const printContent = this.formatOrderForPrint(order)
      console.log(`📄 全局打印内容字符长度: ${printContent.length}`);
      
      const buffer = this.stringToArrayBuffer(printContent)
      console.log(`📦 全局打印数据包大小: ${buffer.byteLength} 字节`);

      // 使用分包发送提高兼容性
      console.log(`📡 开始发送全局打印数据到打印机...`);
      this.sendDataInChunksWithCallback(buffer, characteristic, () => {
        console.log(`✅ 订单 ${order._id} 全局自动打印成功`)
        console.log(`🎉 ===== 全局打印成功完成 =====`);
        
        // 移除打印锁定
        this.globalData.printingOrders.delete(order._id)
        console.log(`🔓 订单 ${order._id} 移除打印锁定`)
        
        // 更新订单打印状态
        this.updateInfo('order_master', order._id, {
          printed: true,
          printTime: this.CurrentTime_show()
        }, () => {
          console.log(`📝 订单 ${order._id} 打印状态已更新`)
          // 打印成功后自动发货
          this.updateGlobalOrderToShipping(order._id)
        })
      }, (err) => {
        console.error(`❌ 订单 ${order._id} 全局自动打印失败:`, err)
        console.log(`💥 ===== 全局打印失败 =====`);
        
        // 移除打印锁定
        this.globalData.printingOrders.delete(order._id)
        console.log(`🔓 订单 ${order._id} 打印失败，移除打印锁定`)
        // 打印失败也要发货，避免订单积压
        this.updateGlobalOrderToShipping(order._id)
      })
    } catch (error) {
      console.error(`全局自动打印订单 ${order._id} 过程出错:`, error)
      console.log(`💥 ===== 全局打印出错 =====`);
      
      // 移除打印锁定
      this.globalData.printingOrders.delete(order._id)
      console.log(`🔓 订单 ${order._id} 打印出错，移除打印锁定`)
      // 出错也要发货，避免订单积压
      this.updateGlobalOrderToShipping(order._id)
    }
  },

  // 检查蓝牙连接状态
  checkBluetoothConnection(characteristic, callback) {
    if (!characteristic || !characteristic.deviceId) {
      callback(false)
      return
    }

    // 尝试获取蓝牙设备连接状态
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

  // 格式化订单打印内容
  formatOrderForPrint(order) {
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

  // 分包发送数据到蓝牙打印机
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

  // 全局更新订单为发货状态
  updateGlobalOrderToShipping(orderId) {
    console.log(`🚚 全局更新订单 ${orderId} 为发货状态`)
    
    this.updateInfo('order_master', orderId, {
      sending: true,
      sendingTime: this.CurrentTime_show()
    }, () => {
      console.log(`✅ 订单 ${orderId} 已自动发货`)
    })
  },

  // --------------常用----------------

  // 判断购物车中是否有重复后添加购物车
  isNotRepeteToCart: function (newCartItem) {
    var self = this
    var isRepete = function() {
      var p = new Promise((resolve, reject) => {
        var flag = false
        self.globalData.carts.forEach((v) => {
          if (v._id === newCartItem._id) {
            flag = true
          }
        })
        resolve(flag)
      })
      return p
    }
    isRepete().then((flag) => {
      if(flag) {
        wx.showToast({
          title: '已经添加过了~',
        })
      }
      else{
        this.globalData.carts.push(newCartItem)
      }
    })
  },

  // 随机数生成函数
  RndNum: function(){
    return Math.random().toString(32).substr(2, 15);
  },

  // 获取时间戳
  CurrentTime: function() {
    var now = new Date();
    var year = now.getFullYear();       //年
    var month = now.getMonth() + 1;     //月
    var day = now.getDate();            //日
    var hh = now.getHours();            //时
    var mm = now.getMinutes();          //分
    var ss = now.getSeconds();           //秒

    var clock = year.toString();
    if (month < 10) clock += "0";
    clock += month;
    if (day < 10) clock += "0";
    clock += day;
    if (hh < 10) clock += "0";
    clock += hh;
    if (mm < 10) clock += '0';
    clock += mm;
    if (ss < 10) clock += '0';
    clock += ss;
    return (clock);
  },

  CurrentTime_show: function () {
    var now = new Date();
    var year = now.getFullYear();       //年
    var month = now.getMonth() + 1;     //月
    var day = now.getDate();            //日
    var hh = now.getHours();            //时
    var mm = now.getMinutes();          //分
    var ss = now.getSeconds();           //秒

    var clock = year.toString()+"-";
    if (month < 10) clock += "0";
    clock += month+"-";
    if (day < 10) clock += "0";
    clock += day+" ";
    if (hh < 10) clock += "0";
    clock += hh+":";
    if (mm < 10) clock += '0';
    clock += mm+":";
    if (ss < 10) clock += '0';
    clock += ss;

    return (clock);
  },


  // 获得n分钟前的时间戳
  beforeNowtimeByMin: function(beforetime) {
    var setFormat = function (x) {
      if (x < 10) x = "0" + x;
      return x;
    }
    var date = new Date();
    date.setMinutes(date.getMinutes() - beforetime);
    var now = "";
    now = date.getFullYear().toString();
    now = now + (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1);
    now = now + setFormat(date.getDate());
    now = now + setFormat(date.getHours());
    now = now + setFormat(date.getMinutes());
    now = now + setFormat(date.getSeconds());
    return now;
  },

  // --------------数据库操作----------------

  // 向集合内新增记录(集合名，要添加的数据对象，回调函数)
  addRowToSet: function(setName,infoObject,callback){
    const db = wx.cloud.database()
    db.collection(setName).add({
      data: infoObject,
      success:callback,
      fail: console.error
    })
  },

  // 从集合中取出数据
  getInfoFromSet: function (setName,selectConditionSet,callBack){
    const db = wx.cloud.database()
    db.collection(setName).where(selectConditionSet).get({
      success:callBack
    })
  },

  // 从集合中筛选数据
  getInfoWhere: function (setName,ruleObj,callback) {
    const db = wx.cloud.database()
    db.collection(setName).where(ruleObj)
      .get({
        success: callback,
        fail: console.error
      })
  },

  // 排序后取出数据
  getInfoByOrder: function (setName, ruleItem, orderFuc,callback) {
    const db = wx.cloud.database()
    db.collection(setName)
      .orderBy(ruleItem, orderFuc)
      .get()
      .then(callback)
      .catch(console.error)
  },

  // 删除集合中的数据
  deleteInfoFromSet: function (setName,fruitId) {
    const db = wx.cloud.database()
      db.collection(setName).doc(fruitId).remove({
      success: e=>{
        wx.showToast({
          title: '删除成功',
        })
        console.log(e)
      },
      fail: console.error
    })
  },

  // 更新数据
  updateInfo:function(setName,_id,updateInfoObj,callback){
    const db = wx.cloud.database()
    db.collection(setName).doc(_id).update({
      data: updateInfoObj,
      success: callback,
      fail: console.error
    })
  },

  // 选择本地图片上传至云端
  selectImgUpToC: function (imgName,tmpUrlCallback) {
    const self = this
    // 获取图片临时地址
    new Promise((resolve,reject)=>{
      wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success(res) {
          // tempFilePath可以作为img标签的src属性显示图片
          resolve(res.tempFilePaths["0"])
        }
      })
    }).then(e => self.upToClound("imgSwiper", imgName, e, tmpUrlCallback))
  },

  // 上传图片到云端（云端文件夹，云端文件名，文件临时地址）
  upToClound: (imgFolder, imgName, myFilePath,fileIDCallback) => {
    wx.cloud.uploadFile({
      cloudPath: imgFolder + "/" + imgName, // 上传至云端的路径
      filePath: myFilePath, // 小程序临时文件路径
      success: res => {
        // 返回文件 ID
        wx.showToast({
          title: '图片已上传',
        })
        fileIDCallback(res.fileID)

      },
      fail: console.error
    })
  },

  // 获取云端文件tmpUrl
  getTmpUrl: (imgFolder, imgName,currentData)=>{
    wx.cloud.getTempFileURL({
      fileList: [getApp().globalData.cloudRoot+imgFolder + "/" + imgName],
      success: res => {
        // console.log(res.fileList["0"].tempFileURL)
        getCurrentPages().setData({
          currentData: res.fileList["0"].tempFileURL
        })
      },
      fail: console.error
    })
  },

  // 带条件查询并排序的函数
  getInfoWhereAndOrder: function (setName, ruleObj, ruleItem, orderFuc, callback) {
    const db = wx.cloud.database()
    db.collection(setName)
      .where(ruleObj)
      .orderBy(ruleItem, orderFuc)
      .get()
      .then(callback)
      .catch(console.error)
  }
})
