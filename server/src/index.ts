import 'dotenv/config'
import app from './app'
import { startFeishuBot } from './adapters/feishuBotAdapter'
import { startFeishuDailyBriefScheduler } from './services/feishuDailyBriefService'

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`[TrainQuest Agent Server] listening on http://localhost:${PORT}`)
})

// 飞书机器人：仅在显式启用且配置了凭证时启动
if (
  process.env.FEISHU_BOT_ENABLED === 'true' &&
  process.env.FEISHU_APP_ID &&
  process.env.FEISHU_APP_SECRET
) {
  startFeishuBot()
  startFeishuDailyBriefScheduler()
}
