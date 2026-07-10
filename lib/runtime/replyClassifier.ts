import { getProvider, ModelProviderName } from '@/lib/providers'
import { ReplyClassificationType } from '@/lib/types'

export type ClassifiedReply = {
  classification: ReplyClassificationType
  confidence: number
  reasoning: string
  actionItems: string[]
}

const VALID_CLASSIFICATIONS: ReplyClassificationType[] = [
  'interested', 'not_interested', 'unsubscribe', 'objection', 'meeting_request', 'referral', 'wrong_contact',
]

// A real reply snippet in, a structured classification out — the LLM
// only ever sees content Gmail actually returned, and a parse failure
// here just means "no classification," not a crash that would also
// lose the underlying reply_received activity (already recorded by the
// caller before this runs).
export async function classifyReply(snippet: string, providerName: ModelProviderName = 'openai'): Promise<ClassifiedReply | null> {
  if (!snippet || !snippet.trim()) return null

  try {
    const model = getProvider(providerName)
    const result = await model.generate({
      systemPrompt: `You classify a prospect's real email reply to a B2B cold outreach message. Respond with ONLY a JSON object, no markdown, no explanation outside the JSON: {"classification": one of ["interested","not_interested","unsubscribe","objection","meeting_request","referral","wrong_contact"], "confidence": a number 0-1, "reasoning": a one-sentence explanation, "action_items": an array of short strings (can be empty)}.`,
      userPrompt: `Reply: "${snippet}"`,
      maxTokens: 250,
    })

    const jsonMatch = result.output.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])

    if (!VALID_CLASSIFICATIONS.includes(parsed.classification)) return null

    return {
      classification: parsed.classification,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      actionItems: Array.isArray(parsed.action_items) ? parsed.action_items.filter((i: unknown) => typeof i === 'string') : [],
    }
  } catch {
    return null
  }
}
