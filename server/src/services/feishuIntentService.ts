import { chatJson } from './aiClientService'

export type IntentType =
  | 'record_workout'
  | 'confirm_pending'
  | 'undo_last'
  | 'query_recent'
  | 'query_today'
  | 'query_last_exercise'
  | 'query_athlete_profile'
  | 'query_goals'
  | 'query_strength_levels'
  | 'update_athlete_field'
  | 'edit_workout'
  | 'confirm_edit'
  | 'cancel_edit'
  | 'select_edit_target'
  | 'training_advice'
  | 'followup_advice'
  | 'cancel_pending'
  | 'query_capabilities'
  | 'sync_dashboard'
  | 'open_dashboard'
  | 'sync_status'
  | 'clarify_question'
  | 'help'
  | 'unknown'

export interface Intent {
  intent: IntentType
  exerciseName?: string
  confidence: number
  cancelPending?: boolean
}

export interface IntentContext {
  text: string
  sessionSummary: string
  pendingState: string
}

const SYSTEM_PROMPT = `你是健身训练助手的意图识别模块。分析用户消息及上下文，输出严格 JSON，不要输出任何解释。

意图类型说明：
- record_workout：用户在描述/记录一次训练，如"卧推三组十个"、"今天练了卧推和跑步"
- confirm_pending：用户想确认/提交待保存的草稿，如"确认"、"对的"、"就这样"、"好的保存"
- undo_last：用户想撤销/删除刚才或本次保存的记录，如"撤销"、"撤销刚刚那个训练记录"、"撤销这次记录"、"删掉上一条"
- query_recent：查询最近训练记录
- query_today：查询今天的训练
- query_last_exercise：查询某动作上次记录，如"上次卧推"
- query_athlete_profile：查看个人体能表
- query_goals：查看训练目标
- query_strength_levels：查看力量水平
- update_athlete_field：更新体能表字段
- edit_workout：修改已有训练记录，如"刚才日期改成昨天"、"把卧推重量改成45kg"、"删掉刚才记录里的跑步"
- confirm_edit：确认执行待确认的修改，如"确认修改"、"就这样改"
- cancel_edit：取消待确认的修改，如"取消修改"、"先不改了"
- select_edit_target：从候选记录中选择要修改的记录，如"1"、"选第二条"
- training_advice：新的训练建议问题，如"今天该练什么"、"深蹲建议多少重量"
- followup_advice：承接上一轮训练建议继续追问，如"那加重点呢"、"今天要不要冲一下"、"保守一点呢"、"按这个来"
- cancel_pending：放弃当前待补充/待确认记录，如"不记了"、"先算了"、"取消这条"、"先不记录了"
- query_capabilities：询问能做什么，如"你能干嘛"、"有哪些功能"、"怎么用"
- sync_dashboard：用户想同步/刷新/更新飞书看板或多维表格，如"帮我同步一下看板"、"刚才那条没有同步到看板"
- open_dashboard：用户想打开/查看训练看板、多维表格或数据中心，如"打开训练看板"、"看一下我的多维表格"
- sync_status：用户询问同步是否完成、同步状态、看板是否最新
- clarify_question：用户表达不清，需要助手追问澄清
- help：请求帮助
- unknown：无法归类

上下文规则：
- activeTopic=advice 且用户用承接词（加重/轻一点/冲一下/保守/那今天呢/按这个来）→ 优先 followup_advice，不是 record_workout
- pendingState=waiting_missing_field 且消息不是数字补充 → 不要 record_workout；若是放弃 → cancel_pending
- 含动作名但无组次重量、且在 advice 上下文 → followup_advice 或 training_advice
- 用户明确要求撤销/删除最近保存、本次保存、刚刚那个训练记录时，用 undo_last；如果只是在描述"刚刚有一组撤销的记录"或投诉同步问题，不要 undo_last
- 提到"没同步/没有同步/同步到看板/刷新看板/更新看板" → sync_dashboard 优先，不要 undo_last 或 record_workout
- 提到"日期不对/重量不对/组数不对/次数不对/改成/修改/纠正"，且目标是已有训练记录 → edit_workout，不是 record_workout
- 在待确认修改上下文里，"确认/好的/就这样" → confirm_edit；"取消/先不改" → cancel_edit

输出格式（只输出 JSON）：
{
  "intent": "followup_advice",
  "exerciseName": "深蹲",
  "confidence": 0.92,
  "cancelPending": true
}

query_last_exercise / followup_advice / training_advice 可填 exerciseName（中文），其余为 null。
cancelPending：followup_advice 或 training_advice 时若应放弃待补充记录则为 true。
confidence 为 0.0-1.0 的浮点数。`

const FALLBACK: Intent = { intent: 'unknown', confidence: 0 }

const VALID_INTENTS: IntentType[] = [
  'record_workout', 'confirm_pending', 'undo_last',
  'query_recent', 'query_today', 'query_last_exercise',
  'query_athlete_profile', 'query_goals', 'query_strength_levels',
  'update_athlete_field',
  'edit_workout', 'confirm_edit', 'cancel_edit', 'select_edit_target',
  'training_advice', 'followup_advice', 'cancel_pending',
  'query_capabilities', 'sync_dashboard', 'open_dashboard', 'sync_status', 'clarify_question',
  'help', 'unknown',
]

export async function detectIntent(ctx: IntentContext): Promise<Intent> {
  const userContent = [
    '【会话上下文】',
    ctx.sessionSummary,
    '',
    '【待处理记录】',
    ctx.pendingState,
    '',
    '【当前消息】',
    ctx.text,
  ].join('\n')

  const result = await chatJson<{
    intent: string
    exerciseName?: string | null
    confidence: number
    cancelPending?: boolean
  }>(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    { timeoutMs: 4000, temperature: 0 },
  )

  if (!result) return FALLBACK

  const intent = VALID_INTENTS.includes(result.intent as IntentType)
    ? (result.intent as IntentType)
    : 'unknown'

  return {
    intent,
    exerciseName: result.exerciseName ?? undefined,
    confidence: typeof result.confidence === 'number' ? result.confidence : 0,
    cancelPending: result.cancelPending === true,
  }
}

/** 规则层快速判断承接建议追问 */
export function ruleMatchFollowupAdvice(text: string, activeTopic?: string): boolean {
  if (activeTopic !== 'advice') return false
  return /加重点|轻一点|冲一下|冲一冲|保守|那今天|按这个|再多|少一点|要不要/.test(text)
}

export function ruleMatchCancelPending(text: string): boolean {
  return /^(取消|算了|不记了|先算了|取消这条|先不记录|不记这条|算了不记)$/.test(text.trim())
}

export function ruleMatchCapabilities(text: string): boolean {
  return /^(你能干嘛|有哪些功能|怎么用|你会什么|能做什么)/.test(text.trim())
}
