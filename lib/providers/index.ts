import { ModelProvider, ModelProviderName } from './types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { LocalModelProvider } from './local'

export * from './types'

export function getProvider(name: ModelProviderName): ModelProvider {
  switch (name) {
    case 'openai': return new OpenAIProvider()
    case 'anthropic': return new AnthropicProvider()
    case 'local': return new LocalModelProvider()
    default: throw new Error(`Unknown model provider: ${name}`)
  }
}
