/**
 * 日期工具函数 - iOS兼容版本
 * 解决iOS设备上日期格式兼容性问题
 */

/**
 * iOS兼容的日期解析函数
 * 将各种日期格式转换为iOS支持的格式
 * @param {string} dateString - 日期字符串
 * @returns {Date|null} - 解析后的Date对象，失败返回null
 */
function parseDate(dateString) {
  if (!dateString) {
    return null;
  }

  try {
    // 如果已经是Date对象，直接返回
    if (dateString instanceof Date) {
      return dateString;
    }

    // 转换为字符串
    let dateStr = dateString.toString().trim();

    // iOS不支持的格式：YYYY-MM-DD HH:mm:ss
    // 需要转换为：YYYY/MM/DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      // 将 "2025-10-20 22:15:21" 转换为 "2025/10/20 22:15:21"
      dateStr = dateStr.replace(/-/g, '/');
      //console.log(`📅 日期格式转换: ${dateString} -> ${dateStr}`);
    }
    
    // 尝试解析日期
    const parsedDate = new Date(dateStr);
    
    // 检查日期是否有效
    if (isNaN(parsedDate.getTime())) {
      console.error(`❌ 日期解析失败: ${dateString}`);
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error(`❌ 日期解析异常: ${dateString}`, error);
    return null;
  }
}

/**
 * 安全的日期比较函数
 * @param {string|Date} date1 - 第一个日期
 * @param {string|Date} date2 - 第二个日期
 * @returns {number} - 比较结果：-1(date1<date2), 0(相等), 1(date1>date2), NaN(解析失败)
 */
function compareDates(date1, date2) {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  
  if (!d1 || !d2) {
    return NaN;
  }
  
  const time1 = d1.getTime();
  const time2 = d2.getTime();
  
  if (time1 < time2) return -1;
  if (time1 > time2) return 1;
  return 0;
}

/**
 * 检查日期是否在指定时间范围内
 * @param {string|Date} targetDate - 目标日期
 * @param {string|Date} startDate - 开始日期
 * @param {string|Date} endDate - 结束日期（可选，默认为当前时间）
 * @returns {boolean} - 是否在范围内
 */
function isDateInRange(targetDate, startDate, endDate = new Date()) {
  const target = parseDate(targetDate);
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (!target || !start || !end) {
    return false;
  }
  
  return target >= start && target <= end;
}

/**
 * 获取指定小时数之前的日期
 * @param {number} hours - 小时数
 * @param {Date} baseDate - 基准日期（可选，默认为当前时间）
 * @returns {Date} - 计算后的日期
 */
function getDateHoursAgo(hours, baseDate = new Date()) {
  return new Date(baseDate.getTime() - hours * 60 * 60 * 1000);
}

/**
 * 格式化日期为字符串
 * @param {Date} date - 日期对象
 * @param {string} format - 格式类型：'datetime', 'date', 'time'
 * @returns {string} - 格式化后的字符串
 */
function formatDate(date, format = 'datetime') {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  switch (format) {
    case 'date':
      return `${year}/${month}/${day}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'datetime':
    default:
      return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }
}

module.exports = {
  parseDate,
  compareDates,
  isDateInRange,
  getDateHoursAgo,
  formatDate
};