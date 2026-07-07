import { ModelProvider, ProviderConfigError, ProviderRequest, ProviderResponse } from './types'

export class OpenAIProvider implements ModelProvider {
  name = 'openai' as const

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new ProviderConfigError('OPENAI_API_KEY is not configured')
    }

    const model = request.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 1024,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 500)}`)
    }

    const data = await res.json()
    const output = data.choices?.[0]?.message?.content ?? ''
    const tokensUsed = data.usage?.total_tokens ?? null

    return { output, model: data.model || model, tokensUsed }
  }
}
