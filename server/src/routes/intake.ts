import { Router } from 'express'
import type { Request, Response } from 'express'
import { parseTrainingText } from '../services/trainingTextParser'

const router = Router()

router.post('/parse', async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string }

  if (!text || !text.trim()) {
    res.status(400).json({ error: 'text 不能为空' })
    return
  }

  if (text.length > 2000) {
    res.status(400).json({ error: '输入文字过长（最多 2000 字符）' })
    return
  }

  try {
    const result = await parseTrainingText(text.trim())
    res.json(result)
  } catch (err) {
    console.error('[intake/parse]', err)
    res.status(500).json({ error: '解析失败，请稍后重试' })
  }
})

export default router
