import { Router, Request, Response } from 'express'
import { getStore as getWorkoutsStore } from '../repositories/workoutRepo'
import { getProfile } from '../repositories/profileRepo'
import { getAttributesStore, getMuscleMapStore, getAchievementsStore } from '../repositories/configRepo'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const data = {
    exportedAt: new Date().toISOString(),
    workouts: getWorkoutsStore(),
    profile: getProfile(),
    attributes: getAttributesStore(),
    muscleMap: getMuscleMapStore(),
    achievements: getAchievementsStore(),
  }
  res.setHeader('Content-Disposition', `attachment; filename="trainquest-agent-export-${new Date().toISOString().slice(0, 10)}.json"`)
  res.setHeader('Content-Type', 'application/json')
  res.json(data)
})

export default router
