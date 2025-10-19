/**
 * 微信小程序蓝牙打印GBK编码工具模块
 * 解决中文字符打印乱码问题
 */

const GBK = require('./gbk.js');

/**
 * 判断字符是否为中文
 * @param {string} char 单个字符
 * @returns {boolean} 是否为中文字符
 */
function isChinese(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * 计算字符串的字节长度（中文字符占2字节，英文字符占1字节）
 * @param {string} str 输入字符串
 * @returns {number} 字节长度
 */
function getStringByteLength(str) {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    if (isChinese(str[i])) {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
}

/**
 * 将字符串转换为ArrayBuffer，使用GBK编码处理中文字符
 * @param {string} str 要转换的字符串
 * @returns {ArrayBuffer} 转换后的ArrayBuffer
 */
function stringToArrayBuffer(str) {
  if (!str) return new ArrayBuffer(0);
  
  try {
    // 使用GBK库进行编码
    const gbkBytes = GBK.encode(str);
    const buffer = new ArrayBuffer(gbkBytes.length);
    const dataView = new DataView(buffer);
    
    // 将GBK编码的字节写入ArrayBuffer
    for (let i = 0; i < gbkBytes.length; i++) {
      dataView.setUint8(i, gbkBytes[i]);
    }
    
    return buffer;
  } catch (error) {
    console.error('GBK编码失败:', error);
    
    // 降级处理：使用手动编码方式
    return stringToArrayBufferManual(str);
  }
}

/**
 * 手动编码方式（降级处理）
 * @param {string} str 要转换的字符串
 * @returns {ArrayBuffer} 转换后的ArrayBuffer
 */
function stringToArrayBufferManual(str) {
  const byteLength = getStringByteLength(str) * 2; // 预留更多空间
  const buffer = new ArrayBuffer(byteLength);
  const dataView = new DataView(buffer);
  let offset = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (isChinese(char)) {
      // 中文字符：尝试使用GBK编码
      try {
        const gbkBytes = GBK.encode(char);
        for (let j = 0; j < gbkBytes.length; j++) {
          dataView.setUint8(offset++, gbkBytes[j]);
        }
      } catch (error) {
        // GBK编码失败，使用UTF-8编码
        const utf8Bytes = encodeUTF8(char);
        for (let j = 0; j < utf8Bytes.length; j++) {
          dataView.setUint8(offset++, utf8Bytes[j]);
        }
      }
    } else {
      // 英文字符：直接使用ASCII编码
      dataView.setUint8(offset++, char.charCodeAt(0));
    }
  }
  
  // 返回实际使用的缓冲区
  return buffer.slice(0, offset);
}

/**
 * UTF-8编码辅助函数
 * @param {string} char 单个字符
 * @returns {number[]} UTF-8字节数组
 */
function encodeUTF8(char) {
  const code = char.charCodeAt(0);
  const bytes = [];
  
  if (code < 0x80) {
    bytes.push(code);
  } else if (code < 0x800) {
    bytes.push(0xC0 | (code >> 6));
    bytes.push(0x80 | (code & 0x3F));
  } else if (code < 0x10000) {
    bytes.push(0xE0 | (code >> 12));
    bytes.push(0x80 | ((code >> 6) & 0x3F));
    bytes.push(0x80 | (code & 0x3F));
  } else {
    bytes.push(0xF0 | (code >> 18));
    bytes.push(0x80 | ((code >> 12) & 0x3F));
    bytes.push(0x80 | ((code >> 6) & 0x3F));
    bytes.push(0x80 | (code & 0x3F));
  }
  
  return bytes;
}

/**
 * 测试编码函数
 * @param {string} testStr 测试字符串
 */
function testEncoding(testStr) {
  console.log('测试字符串:', testStr);
  
  try {
    const buffer = stringToArrayBuffer(testStr);
    const bytes = new Uint8Array(buffer);
    console.log('编码结果:', Array.from(bytes));
    console.log('字节长度:', bytes.length);
  } catch (error) {
    console.error('编码测试失败:', error);
  }
}

module.exports = {
  stringToArrayBuffer,
  isChinese,
  getStringByteLength,
  testEncoding
};