import express from 'express'
import cors from 'cors'
import workoutsRouter from './routes/workouts'
import attributesRouter from './routes/attributes'
import profileRouter from './routes/profile'
import muscleMapRouter from './routes/muscleMap'
import achievementsRouter from './routes/achievements'
import dashboardRouter from './routes/dashboard'
import exportRouter from './routes/export'
import intakeRouter from './routes/intake'

const app = express()

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.use('/api/workouts', workoutsRouter)
app.use('/api/attributes', attributesRouter)
app.use('/api/profile', profileRouter)
app.use('/api/muscle-map', muscleMapRouter)
app.use('/api/achievements', achievementsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/export', exportRouter)
app.use('/api/intake', intakeRouter)

export default app
