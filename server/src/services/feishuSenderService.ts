import * as Lark from '@larksuiteoapi/node-sdk'
import type { FeishuCard } from './feishuCardService'

let cachedClient: Lark.Client | null = null

export function getFeishuClient(): Lark.Client {
  if (cachedClient) return cachedClient
  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET')
  }
  cachedClient = new Lark.Client({ appId, appSecret })
  return cachedClient
}

export async function sendFeishuText(
  client: Lark.Client,
  chatId: string,
  text: string,
): Promise<void> {
  await client.im.v1.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
  })
}

export async function sendFeishuCard(
  client: Lark.Client,
  chatId: string,
  card: FeishuCard,
): Promise<void> {
  await client.im.v1.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
  })
}

export async function sendFeishuTextToChat(chatId: string, text: string): Promise<void> {
  await sendFeishuText(getFeishuClient(), chatId, text)
}

export async function sendFeishuCardToChat(chatId: string, card: FeishuCard): Promise<void> {
  await sendFeishuCard(getFeishuClient(), chatId, card)
}
