import { Router, Request, Response } from 'express'
import { getProfile, saveProfile, addWeightLog } from '../repositories/profileRepo'
import { isValidDate, isPositiveNumber } from '../utils/validation'
import { enqueueFeishuAutoSync } from '../services/feishuAutoSyncService'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json(getProfile())
})

router.put('/', (req: Request, res: Response) => {
  const profile = getProfile()
  const { body: reqBody, goal, avatar } = req.body

  if (reqBody) {
    if (reqBody.heightCm !== undefined && isPositiveNumber(reqBody.heightCm)) {
      profile.body.heightCm = reqBody.heightCm
    }
    if (reqBody.currentWeightKg !== undefined && isPositiveNumber(reqBody.currentWeightKg)) {
      profile.body.currentWeightKg = reqBody.currentWeightKg
    }
  }

  if (goal) {
    const validGoals = ['lose_weight', 'gain_muscle', 'maintain', 'improve_cardio']
    if (goal.type && validGoals.includes(goal.type)) {
      profile.goal.type = goal.type
    }
    if (goal.targetWeightKg !== undefined) {
      profile.goal.targetWeightKg = goal.targetWeightKg
    }
    if (goal.targetDate !== undefined) {
      profile.goal.targetDate = goal.targetDate
    }
  }

  if (avatar) {
    Object.assign(profile.avatar, avatar)
  }

  saveProfile(profile)
  enqueueFeishuAutoSync('profile_updated')
  res.json(profile)
})

router.post('/weight-logs', (req: Request, res: Response) => {
  const { date, weightKg } = req.body
  if (!isValidDate(date)) {
    res.status(400).json({ error: 'date 格式错误' })
    return
  }
  if (!isPositiveNumber(weightKg)) {
    res.status(400).json({ error: 'weightKg 必须为正数' })
    return
  }
  addWeightLog({ date, weightKg })
  enqueueFeishuAutoSync('weight_updated')
  res.status(201).json({ success: true })
})

export default router
