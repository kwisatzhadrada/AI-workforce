export type ModelProviderName = 'openai' | 'anthropic' | 'local'

export type ProviderRequest = {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}

export type ProviderResponse = {
  output: string
  model: string
  tokensUsed: number | null
}

export interface ModelProvider {
  name: ModelProviderName
  generate(request: ProviderRequest): Promise<ProviderResponse>
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderConfigError'
  }
}
