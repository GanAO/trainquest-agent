import { parseLoosePositiveInt } from './numberParser'

const BLOCK_PATTERNS = /建议|保守|冲一下|冲一冲|加重|轻一点|不记|取消|算了|要不要|是不是|太保守|先不|聊聊|怎么办/

const SUPPLEMENT_PATTERN =
  /^(每组)?\s*[\d一二两三四五六七八九十百]+[个下次数组]?\s*$|^\d+\s*(分钟|分|次|组|个|下)\s*$/

/** 判断用户回复是否像 missing field 的数字补充 */
export function isLikelyMissingFieldAnswer(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (BLOCK_PATTERNS.test(t)) return false

  // 纯确认词不走 missing field
  if (/^(确认|好的|是)$/.test(t)) return false

  if (SUPPLEMENT_PATTERN.test(t)) return true

  if (/分钟|分$/.test(t) && parseLoosePositiveInt(t) !== null) return true

  const num = parseLoosePositiveInt(t)
  if (num !== null && t.length <= 20) return true

  return false
}
