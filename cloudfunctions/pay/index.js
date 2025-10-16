/*
 * @Author: yangwei yangnuowei@126.com
 * @Date: 2025-10-14 18:29:44
 * @LastEditors: yangwei yangnuowei@126.com
 * @LastEditTime: 2025-10-16 14:56:18
 * @FilePath: \Fruit-store-mp\cloudfunctions\pay\index.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 云函数入口文件
const cloud = require('wx-server-sdk')
const request = require('request')

cloud.init()

// 云函数入口函数
// 获取prepay_id
exports.main = async (event, context) => {  
  let result = await getPrepayIdPromise(event);
  return result
}

const getPrepayIdPromise = function (event) {
  return new Promise((resolve, reject) => {
    let options = {
      "url": 'https://api.mch.weixin.qq.com/pay/unifiedorder',
      "method": "POST",
      "headers": {
        "Content-Type": "text/xml",
        "charset": "utf-8"
      },
      "form": event.xmlData
    };
    request.post(options, (err, result, body) => {
      resolve({
        err: err,
        body: body
      })
    })
  })
}