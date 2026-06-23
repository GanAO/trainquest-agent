import { Router, Request, Response } from 'express'
import { getMuscleMapStore, saveMuscleMapStore } from '../repositories/configRepo'
import type { MuscleMapEntry } from '../domain/types'

interface NameParam { name: string }

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json(getMuscleMapStore())
})

router.post('/', (req: Request, res: Response) => {
  const store = getMuscleMapStore()
  const entry = req.body as MuscleMapEntry

  if (!entry.exerciseName?.trim()) {
    res.status(400).json({ error: 'exerciseName 不能为空' })
    return
  }

  const exists = store.items.find(
    i => i.exerciseName.toLowerCase() === entry.exerciseName.toLowerCase(),
  )
  if (exists) {
    res.status(409).json({ error: '该动作已存在' })
    return
  }

  const newEntry: MuscleMapEntry = {
    exerciseName: entry.exerciseName.trim(),
    aliases: entry.aliases ?? [],
    type: entry.type ?? 'strength',
    primary: entry.primary ?? [],
    secondary: entry.secondary ?? [],
    enabled: true,
    custom: true,
  }

  store.items.push(newEntry)
  saveMuscleMapStore(store)
  res.status(201).json(newEntry)
})

router.put('/:name', (req: Request<NameParam>, res: Response) => {
  const store = getMuscleMapStore()
  const name = decodeURIComponent(req.params.name)
  const idx = store.items.findIndex(
    i => i.exerciseName.toLowerCase() === name.toLowerCase(),
  )
  if (idx < 0) {
    res.status(404).json({ error: '动作不存在' })
    return
  }

  store.items[idx] = { ...store.items[idx], ...req.body }
  saveMuscleMapStore(store)
  res.json(store.items[idx])
})

router.delete('/:name', (req: Request<NameParam>, res: Response) => {
  const store = getMuscleMapStore()
  const name = decodeURIComponent(req.params.name)
  const idx = store.items.findIndex(
    i => i.exerciseName.toLowerCase() === name.toLowerCase(),
  )
  if (idx < 0) {
    res.status(404).json({ error: '动作不存在' })
    return
  }
  if (!store.items[idx].custom) {
    res.status(403).json({ error: '内置动作不能删除，只能禁用' })
    return
  }
  store.items.splice(idx, 1)
  saveMuscleMapStore(store)
  res.json({ success: true })
})

export default router
