/**
 * 返回 ISO 周号键，格式：2026-W23
 */
export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * 返回月份键，格式：2026-06
 */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 今天的 YYYY-MM-DD 字符串
 */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function localDateStr(offsetDays = 0, timeZone = 'Asia/Shanghai'): string {
  const today = new Date().toLocaleDateString('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')

  if (offsetDays === 0) return today

  const base = new Date(`${today}T00:00:00+08:00`)
  base.setDate(base.getDate() + offsetDays)
  return base.toLocaleDateString('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')
}
