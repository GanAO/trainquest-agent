import { Router, Request, Response } from 'express'
import { getAllWorkouts, getWorkoutById, deleteWorkout } from '../repositories/workoutRepo'
import { createWorkout } from '../services/workoutService'
import { updateWorkout } from '../services/workoutEditService'
import { recalculateFromWorkouts } from '../services/attributeService'
import { validateWorkoutInput } from '../utils/validation'
import { enqueueFeishuAutoSync } from '../services/feishuAutoSyncService'

interface IdParam { id: string }

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const from = Array.isArray(_req.query.from) ? String(_req.query.from[0]) : _req.query.from as string | undefined
  const to = Array.isArray(_req.query.to) ? String(_req.query.to[0]) : _req.query.to as string | undefined
  let workouts = getAllWorkouts()
  if (from) workouts = workouts.filter(w => w.date >= from)
  if (to) workouts = workouts.filter(w => w.date <= to)
  res.json({ items: workouts, total: workouts.length })
})

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const workout = getWorkoutById(req.params.id)
  if (!workout) {
    res.status(404).json({ error: '训练记录不存在' })
    return
  }
  res.json(workout)
})

router.post('/', (req: Request, res: Response) => {
  const errors = validateWorkoutInput(req.body)
  if (errors.length > 0) {
    res.status(400).json({ errors })
    return
  }

  try {
    const result = createWorkout(req.body)
    res.status(201).json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.patch('/:id', (req: Request<IdParam>, res: Response) => {
  try {
    const result = updateWorkout(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    const message = (err as Error).message
    if (message === '训练记录不存在') {
      res.status(404).json({ error: message })
      return
    }
    res.status(400).json({ error: message })
  }
})

router.delete('/:id', (req: Request<IdParam>, res: Response) => {
  const deleted = deleteWorkout(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: '训练记录不存在' })
    return
  }
  recalculateFromWorkouts(getAllWorkouts())
  enqueueFeishuAutoSync('workout_deleted')
  res.json({ success: true })
})

export default router
