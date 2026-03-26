/**
 * 日期格式化工具
 *
 * 规则：后端存储和返回的都是本地时间（东8区），前端直接显示，不做任何 UTC/本地时间转换
 */

import dayjs from 'dayjs'

/**
 * 格式化时间字符串
 * @param {string} dateStr - 时间字符串（本地时间）
 * @param {string} format - 格式化模板，默认 'YYYY-MM-DD HH:mm'
 * @returns {string} 格式化后的时间字符串
 */
export function formatDate(dateStr, format = 'YYYY-MM-DD HH:mm') {
  if (!dateStr) return '-'
  if (typeof dateStr !== 'string') return '-'

  // 直接解析时间字符串，不做时区转换
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return dateStr

  const [, year, month, day, hour, minute, second] = match

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 格式化时间字符串（带秒）
 */
export function formatDateTime(dateStr) {
  return formatDate(dateStr, 'YYYY-MM-DD HH:mm:ss')
}

/**
 * 格式化日期字符串
 */
export function formatDateOnly(dateStr) {
  return formatDate(dateStr, 'YYYY-MM-DD')
}

/**
 * 解析时间字符串为 dayjs 对象（用于日期选择器）
 */
export function parseDate(dateStr) {
  if (!dateStr) return null
  return dayjs(dateStr)
}

// 兼容旧代码
export const getLocalDayjs = parseDate

export { dayjs }