import { ModelProvider, ProviderConfigError, ProviderRequest, ProviderResponse } from './types'

// Targets an Ollama-compatible local inference server (the most common way to
// run open models locally with a stable HTTP API). Configure LOCAL_MODEL_URL
// to point at a different OpenAI-compatible local server if needed.
export class LocalModelProvider implements ModelProvider {
  name = 'local' as const

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const baseUrl = process.env.LOCAL_MODEL_URL || 'http://localhost:11434'
    const model = request.model || process.env.LOCAL_MODEL_NAME
    if (!model) {
      throw new ProviderConfigError('LOCAL_MODEL_NAME is not configured')
    }

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
    }).catch((err) => {
      throw new Error(`Local model server unreachable at ${baseUrl}: ${err.message}`)
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Local model request failed (${res.status}): ${body.slice(0, 500)}`)
    }

    const data = await res.json()
    const output = data.message?.content ?? ''
    const tokensUsed = typeof data.eval_count === 'number'
      ? data.eval_count + (typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : 0)
      : null

    return { output, model: data.model || model, tokensUsed }
  }
}
