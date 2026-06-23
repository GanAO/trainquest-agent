const CN_DIGIT: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  俩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const UNIT_SUFFIX = /[个下次数组分钟分]+$/

/** 口语「一百二」→ 120（非 102） */
function parseColloquialHundred(s: string): number | null {
  const m = s.match(/^一百([二三四五六七八九])$/)
  if (m) return 100 + CN_DIGIT[m[1]] * 10
  return null
}

/**
 * 解析纯中文数字片段（不含单位）。
 * 支持：三、十五、二十、一百、一百二(→120)、一百二十五、两百
 */
export function parseChineseNumber(raw: string): number | null {
  const s = raw.replace(UNIT_SUFFIX, '').trim()
  if (!s) return null

  if (s === '两百' || s === '二百') return 200

  const colloquial = parseColloquialHundred(s)
  if (colloquial !== null) return colloquial

  if (s === '一百') return 100

  // X百Y十Z：一百二十五、一百二十
  if (s.includes('百')) {
    let rest = s
    let total = 0
    const baiMatch = rest.match(/^([一二两三四五六七八九])?百/)
    if (baiMatch) {
      const hundreds = baiMatch[1] ? CN_DIGIT[baiMatch[1]] : 1
      total += hundreds * 100
      rest = rest.slice(baiMatch[0].length)
    }
    if (rest.startsWith('十')) {
      const afterShi = rest.slice(1)
      if (!afterShi) {
        total += 10
      } else if (afterShi in CN_DIGIT) {
        total += 10 + CN_DIGIT[afterShi]
      } else {
        const sub = parseChineseNumber(rest)
        if (sub !== null) total += sub
      }
      return total > 0 ? total : null
    }
    if (rest) {
      const sub = parseChineseNumber(rest)
      if (sub !== null) total += sub
    }
    return total > 0 ? total : null
  }

  // 十、十一…十九
  if (s.startsWith('十')) {
    const rest = s.slice(1)
    if (!rest) return 10
    if (rest in CN_DIGIT) return 10 + CN_DIGIT[rest]
    return null
  }

  // 二十、五十、二十五
  if (s.endsWith('十')) {
    const head = s.slice(0, -1)
    if (!head) return 10
    if (head in CN_DIGIT) return CN_DIGIT[head] * 10
    return null
  }

  const shiIdx = s.indexOf('十')
  if (shiIdx > 0) {
    const before = s.slice(0, shiIdx)
    const after = s.slice(shiIdx + 1)
    if (before in CN_DIGIT) {
      const tens = CN_DIGIT[before] * 10
      const ones = after && after in CN_DIGIT ? CN_DIGIT[after] : 0
      return tens + ones
    }
  }

  if (s in CN_DIGIT && CN_DIGIT[s] > 0) return CN_DIGIT[s]

  return null
}

interface FoundNumber {
  index: number
  value: number
}

const CN_SEGMENT = /[零一二两俩三四五六七八九十百]+/g

/**
 * 从自然语言中提取正整数，不做业务范围校验。
 * 多个数字时取文中最后一个。
 */
export function parseLoosePositiveInt(text: string): number | null {
  const found: FoundNumber[] = []

  const arabicRe = /\d+/g
  let m: RegExpExecArray | null
  while ((m = arabicRe.exec(text)) !== null) {
    const value = parseInt(m[0], 10)
    if (value > 0) found.push({ index: m.index, value })
  }

  while ((m = CN_SEGMENT.exec(text)) !== null) {
    const value = parseChineseNumber(m[0])
    if (value !== null && value > 0) found.push({ index: m.index, value })
  }

  if (found.length === 0) return null

  found.sort((a, b) => a.index - b.index)
  return found[found.length - 1].value
}
