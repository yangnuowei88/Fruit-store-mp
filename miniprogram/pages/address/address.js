Page({
  data: {
    address: {
      name: '',
      phone: '',
      detail: '',
      message: ""
    },
    // 校验状态
    validation: {
      nameValid: true,
      phoneValid: true,
      detailValid: true,
      messageValid: true
    },
    // 错误提示信息
    errors: {
      name: '',
      phone: '',
      detail: '',
      message: ''
    }
  },

  onLoad() {
    var self = this;
    wx.getStorage({
      key: 'address',
      success: function (res) {
        self.setData({
          address: res.data
        })
      }
    })
  },

  // 实时校验姓名输入
  onNameInput(e) {
    const name = e.detail.value;
    const validation = this.validateName(name);
    this.setData({
      'address.name': name,
      'validation.nameValid': validation.valid,
      'errors.name': validation.valid ? '' : validation.message
    });
  },

  // 实时校验手机号输入
  onPhoneInput(e) {
    const phone = e.detail.value;
    const validation = this.validatePhone(phone);
    this.setData({
      'address.phone': phone,
      'validation.phoneValid': validation.valid,
      'errors.phone': validation.valid ? '' : validation.message
    });
  },

  // 实时校验地址输入
  onDetailInput(e) {
    const detail = e.detail.value;
    const validation = this.validateAddress(detail);
    this.setData({
      'address.detail': detail,
      'validation.detailValid': validation.valid,
      'errors.detail': validation.valid ? '' : validation.message
    });
  },

  // 实时校验备注输入
  onMessageInput(e) {
    const message = e.detail.value;
    const validation = this.validateMessage(message);
    this.setData({
      'address.message': message,
      'validation.messageValid': validation.valid,
      'errors.message': validation.valid ? '' : validation.message
    });
  },
  //   console.log(getCurrentPages()["0"].data)
  //   var { name, phone, schoolName, addressItem, apartmentNum } = getCurrentPages()["0"].data;
  //   var value = { name, phone, schoolName, addressItem, apartmentNum } 
  //   console.log(value)
  //   if (value.name && value.phone.length === 11 && value.detail) {
  //     console.log(value)
  //     wx.setStorage({
  //       key: 'address',
  //       data: value,
  //       success() {
  //         wx.navigateBack();
  //       }
  //     })
  //   } else {
  //     wx.showModal({
  //       title: '提示',
  //       content: '请填写完整资料',
  //       showCancel: false
  //     })
  //   }
  // },

  // 校验姓名格式
  validateName(name) {
    if (!name || name.trim() === '') {
      return { valid: false, message: '请输入收货人姓名' };
    }
    if (name.trim().length < 2) {
      return { valid: false, message: '姓名至少需要2个字符' };
    }
    if (name.trim().length > 30) {
      return { valid: false, message: '姓名不能超过30个字符' };
    }
    // 检查是否包含特殊字符（只允许中文、英文、数字）
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/;
    if (!nameRegex.test(name.trim())) {
      return { valid: false, message: '姓名只能包含中文、英文和数字' };
    }
    return { valid: true };
  },

  // 校验手机号码格式
  validatePhone(phone) {
    if (!phone || phone.trim() === '') {
      return { valid: false, message: '请输入手机号码' };
    }
    // 移除所有空格和特殊字符
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length !== 11) {
      return { valid: false, message: '手机号码必须是11位数字' };
    }
    // 检查是否全为数字
    if (!/^\d{11}$/.test(cleanPhone)) {
      return { valid: false, message: '手机号码只能包含数字' };
    }
    // 检查手机号码格式（以1开头，第二位是3-9）
    if (!/^1[3-9]\d{9}$/.test(cleanPhone)) {
      return { valid: false, message: '请输入正确的手机号码格式' };
    }
    return { valid: true, phone: cleanPhone };
  },

  // 校验详细地址
  validateAddress(address) {
    if (!address || address.trim() === '') {
      return { valid: false, message: '请输入详细收货地址' };
    }
    if (address.trim().length < 5) {
      return { valid: false, message: '详细地址至少需要5个字符，请填写完整的收货地址' };
    }
    if (address.trim().length > 200) {
      return { valid: false, message: '详细地址不能超过200个字符' };
    }
    return { valid: true };
  },

  // 校验备注信息
  validateMessage(message) {
    if (message && message.length > 100) {
      return { valid: false, message: '备注信息不能超过100个字符' };
    }
    return { valid: true };
  },

  formSubmit(e) {
    const value = e.detail.value;
    console.log('表单提交数据:', value);

    // 逐一校验各个字段
    const nameValidation = this.validateName(value.name);
    if (!nameValidation.valid) {
      wx.showModal({
        title: '姓名格式错误',
        content: nameValidation.message,
        showCancel: false
      });
      return;
    }

    const phoneValidation = this.validatePhone(value.phone);
    if (!phoneValidation.valid) {
      wx.showModal({
        title: '手机号码错误',
        content: phoneValidation.message,
        showCancel: false
      });
      return;
    }

    const addressValidation = this.validateAddress(value.detail);
    if (!addressValidation.valid) {
      wx.showModal({
        title: '地址信息错误',
        content: addressValidation.message,
        showCancel: false
      });
      return;
    }

    const messageValidation = this.validateMessage(value.message);
    if (!messageValidation.valid) {
      wx.showModal({
        title: '备注信息错误',
        content: messageValidation.message,
        showCancel: false
      });
      return;
    }

    // 所有校验通过，保存数据
    const validatedData = {
      name: value.name.trim(),
      phone: phoneValidation.phone || value.phone.replace(/\s+/g, ''),
      detail: value.detail.trim(),
      message: value.message ? value.message.trim() : ''
    };

    console.log('校验通过，保存数据:', validatedData);
    
    wx.setStorage({
      key: 'address',
      data: validatedData,
      success() {
        wx.showToast({
          title: '地址保存成功',
          icon: 'success',
          duration: 1500
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail() {
        wx.showModal({
          title: '保存失败',
          content: '地址信息保存失败，请重试',
          showCancel: false
        });
      }
    });
  }
})