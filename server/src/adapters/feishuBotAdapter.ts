import * as Lark from '@larksuiteoapi/node-sdk'
import { handleFeishuMessage } from '../services/feishuCommandService'
import { getFeishuClient, sendFeishuCard, sendFeishuText } from '../services/feishuSenderService'

// ─── 消息去重（防飞书重推重复保存）────────────────────────────────────────────

const recentMessageIds = new Set<string>()
const MESSAGE_ID_CACHE_MAX = 200

function isDuplicate(messageId: string): boolean {
  if (recentMessageIds.has(messageId)) return true
  recentMessageIds.add(messageId)
  if (recentMessageIds.size > MESSAGE_ID_CACHE_MAX) {
    const first = recentMessageIds.values().next().value
    if (first !== undefined) recentMessageIds.delete(first)
  }
  return false
}

// ─── Allowlist 鉴权 ───────────────────────────────────────────────────────────

function isAllowed(openId?: string, chatId?: string): boolean {
  const allowedUsers = (process.env.FEISHU_ALLOWED_USER_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const allowedChats = (process.env.FEISHU_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  // 未配置任何白名单时，拒绝所有请求（保护本地数据）
  if (allowedUsers.length === 0 && allowedChats.length === 0) return false
  if (openId && allowedUsers.includes(openId)) return true
  if (chatId && allowedChats.includes(chatId)) return true
  return false
}

// ─── 同一用户消息串行化（保护"刚才/上一条"上下文）──────────────────────────────

const messageQueues = new Map<string, Promise<void>>()

function enqueueUserMessage(key: string, task: () => Promise<void>): void {
  const previous = messageQueues.get(key) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(task)
    .catch(err => {
      console.error('[FeishuBot] queued task error:', err)
    })
    .finally(() => {
      if (messageQueues.get(key) === current) messageQueues.delete(key)
    })
  messageQueues.set(key, current)
}

// ─── 启动飞书 Bot ─────────────────────────────────────────────────────────────

export function startFeishuBot(): void {
  const appId = process.env.FEISHU_APP_ID!
  const appSecret = process.env.FEISHU_APP_SECRET!

  const client = getFeishuClient()
  const wsClient = new Lark.WSClient({ appId, appSecret })

  const eventDispatcher = new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      // fire-and-forget：handler 立即返回，避免超时重推
      processMessage(client, data).catch(err =>
        console.error('[FeishuBot] processMessage error:', err),
      )
    },
  })

  wsClient.start({ eventDispatcher })
  console.log('[FeishuBot] WebSocket client starting...')
}

// ─── 消息处理（异步，在 handler 外执行）──────────────────────────────────────

async function processMessage(
  client: Lark.Client,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<void> {
  const message = data.message
  const sender = data.sender

  const messageId: string = message?.message_id ?? ''
  const chatId: string = message?.chat_id ?? ''
  const openId: string = sender?.sender_id?.open_id ?? ''
  const msgType: string = message?.message_type ?? ''
  const rawContent: string = message?.content ?? ''

  // 去重
  if (messageId && isDuplicate(messageId)) {
    console.log(`[FeishuBot] Duplicate message ${messageId}, skipping`)
    return
  }

  // 鉴权
  if (!isAllowed(openId, chatId)) {
    console.log(`[FeishuBot] Unauthorized: openId=${openId} chatId=${chatId}`)
    return
  }

  // 非文本消息
  if (msgType !== 'text') {
    await sendFeishuText(client, chatId, '暂时只支持文字训练记录，请直接发文本消息')
    return
  }

  // 解析飞书 content（JSON 字符串 {"text": "..."}）
  let text = ''
  try {
    text = (JSON.parse(rawContent) as { text?: string }).text?.trim() ?? ''
  } catch {
    text = rawContent.trim()
  }

  if (!text) return

  console.log(`[FeishuBot] Received from ${openId}: ${text.slice(0, 80)}`)

  enqueueUserMessage(`${chatId}:${openId}`, async () => {
    // 先发即时反馈（如需要），再发最终结果
    const result = await handleFeishuMessage(chatId, openId, text)

    if (result.immediateReply) {
      await sendFeishuText(client, chatId, result.immediateReply)
    }
    if (result.finalCard) {
      await sendFeishuCard(client, chatId, result.finalCard)
    } else {
      await sendFeishuText(client, chatId, result.finalReply)
    }
  })
}
