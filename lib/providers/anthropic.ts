import { ModelProvider, ProviderConfigError, ProviderRequest, ProviderResponse } from './types'

export class AnthropicProvider implements ModelProvider {
  name = 'anthropic' as const

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new ProviderConfigError('ANTHROPIC_API_KEY is not configured')
    }

    const model = request.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 500)}`)
    }

    const data = await res.json()
    const output = (data.content || []).map((block: { type: string; text?: string }) => block.text || '').join('')
    const tokensUsed = data.usage ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0) : null

    return { output, model: data.model || model, tokensUsed }
  }
}
