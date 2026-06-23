import { Router, Request, Response } from 'express'
import { getDashboardData } from '../services/dashboardService'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { from, to } = req.query as Record<string, string>
  const data = getDashboardData(from, to)
  res.json(data)
})

export default router
