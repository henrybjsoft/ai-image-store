import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 扩展 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 将 UTC 时间字符串转换为本地时间
 * @param {string} dateStr - UTC 时间字符串（如 '2024-01-01 12:00:00' 或 ISO 格式）
 * @returns {dayjs.Dayjs} 本地时间的 dayjs 对象
 */
export function parseUTC(dateStr) {
  if (!dateStr) return null

  // 如果已经是 ISO 格式（带 Z 或时区信息），直接解析
  if (dateStr.includes('T') && (dateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr))) {
    return dayjs(dateStr)
  }

  // 否则假设是 UTC 时间字符串，添加 Z 后缀
  return dayjs.utc(dateStr).local()
}

/**
 * 格式化 UTC 时间为本地时间字符串
 * @param {string} dateStr - UTC 时间字符串
 * @param {string} format - 格式化模板，默认 'YYYY-MM-DD HH:mm'
 * @returns {string} 格式化后的本地时间字符串
 */
export function formatDate(dateStr, format = 'YYYY-MM-DD HH:mm') {
  if (!dateStr) return '-'
  const localDate = parseUTC(dateStr)
  return localDate ? localDate.format(format) : '-'
}

/**
 * 格式化 UTC 时间为本地时间字符串（带秒）
 * @param {string} dateStr - UTC 时间字符串
 * @returns {string} 格式化后的本地时间字符串
 */
export function formatDateTime(dateStr) {
  return formatDate(dateStr, 'YYYY-MM-DD HH:mm:ss')
}

/**
 * 格式化 UTC 时间为本地日期字符串
 * @param {string} dateStr - UTC 时间字符串
 * @returns {string} 格式化后的本地日期字符串
 */
export function formatDateOnly(dateStr) {
  return formatDate(dateStr, 'YYYY-MM-DD')
}

/**
 * 获取本地时间的 dayjs 对象（用于日期选择器）
 * @param {string} dateStr - UTC 时间字符串
 * @returns {dayjs.Dayjs|null} 本地时间的 dayjs 对象
 */
export function getLocalDayjs(dateStr) {
  return parseUTC(dateStr)
}

/**
 * 将本地时间转换为 UTC 时间字符串（用于提交到后端）
 * @param {dayjs.Dayjs|string} date - 本地时间
 * @returns {string} UTC 时间字符串
 */
export function toUTCString(date) {
  if (!date) return null
  const d = dayjs.isDayjs(date) ? date : dayjs(date)
  return d.utc().format('YYYY-MM-DD HH:mm:ss')
}

export { dayjs }