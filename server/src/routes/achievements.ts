import { Router, Request, Response } from 'express'
import { getAchievementsStore } from '../repositories/configRepo'
import { runAchievementCheck } from '../services/achievementEngine'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const store = getAchievementsStore()
  const unlockedIds = new Set(store.unlocked.map(u => u.id))
  const items = store.definitions.map(def => ({
    ...def,
    unlocked: unlockedIds.has(def.id),
    unlockedAt: store.unlocked.find(u => u.id === def.id)?.unlockedAt ?? null,
  }))
  res.json({ items, unlockedCount: store.unlocked.length, totalCount: store.definitions.length })
})

router.post('/recalculate', (_req: Request, res: Response) => {
  const newAchievements = runAchievementCheck()
  res.json({ newAchievements })
})

export default router
