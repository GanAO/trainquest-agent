// 统一 AI HTTP 客户端
// 提供商优先级：DEEPSEEK_API_KEY > OPENAI_API_KEY > AI_BASE_URL+AI_API_KEY+AI_MODEL

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  timeoutMs?: number
  jsonMode?: boolean
  temperature?: number
}

interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
  provider: string
}

function getAiConfig(): AiConfig | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    return {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: deepseekKey,
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
      provider: 'DeepSeek',
    }
  }
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      provider: 'OpenAI',
    }
  }
  const customBase = process.env.AI_BASE_URL
  const customKey = process.env.AI_API_KEY
  const customModel = process.env.AI_MODEL
  if (customBase && customKey && customModel) {
    return { baseUrl: customBase, apiKey: customKey, model: customModel, provider: 'Custom' }
  }
  return null
}

/** 是否有可用的 AI 配置 */
export function hasAiConfig(): boolean {
  return getAiConfig() !== null
}

/**
 * 调用 AI 并返回解析后的 JSON。
 * 失败（无配置、超时、解析错误）时返回 null。
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<T | null> {
  const config = getAiConfig()
  if (!config) return null

  const { timeoutMs = 15000, temperature = 0 } = opts

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      console.warn(`[AI] ${config.provider} error ${response.status}`)
      return null
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    return JSON.parse(content) as T
  } catch (err) {
    console.warn(`[AI] ${config.provider} failed:`, (err as Error).message)
    return null
  }
}

/**
 * 调用 AI 并返回纯文本。
 * 失败时返回 null。
 */
export async function chatText(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string | null> {
  const config = getAiConfig()
  if (!config) return null

  const { timeoutMs = 15000, temperature = 0.7 } = opts

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      console.warn(`[AI] ${config.provider} error ${response.status}`)
      return null
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices?.[0]?.message?.content ?? null
  } catch (err) {
    console.warn(`[AI] ${config.provider} failed:`, (err as Error).message)
    return null
  }
}
