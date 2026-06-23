import { Router, Request, Response } from 'express'
import { getAttributes, recalculateFromWorkouts } from '../services/attributeService'
import { getAllWorkouts } from '../repositories/workoutRepo'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json(getAttributes())
})

router.post('/recalculate', (_req: Request, res: Response) => {
  const workouts = getAllWorkouts()
  recalculateFromWorkouts(workouts)
  res.json({ success: true, message: '属性已从训练记录重新计算' })
})

export default router
