// 云函数入口文件
const cloud = require('wx-server-sdk')
const request = require('request')

cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
  let result = await getIPAddressPromise();
  return result
}

const getIPAddressPromise = function () {
  return new Promise((resolve, reject) => {
    let options = {
      "url": 'http://ip-api.com/json',
      "method": "GET",
      "timeout": 5000,
      "headers": {
        "User-Agent": "Mozilla/5.0"
      }
    };
    request(options, (err, result, body) => {
      if (err) {
        // 如果获取失败，返回默认IP
        resolve({
          err: null,
          body: JSON.stringify({
            query: '127.0.0.1',
            status: 'success'
          })
        });
      } else {
        resolve({
          err: err,
          body: body
        });
      }
    })
  })
}