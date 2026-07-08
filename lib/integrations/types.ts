export type IntegrationProviderName = 'gmail' | 'hubspot' | 'hunter'

export class IntegrationConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationConfigError'
  }
}

export type ProspectContact = {
  name: string | null
  email: string
  title: string | null
  confidence: number | null
}

export type EnrichedCompany = {
  domain: string
  companyName: string | null
  people: ProspectContact[]
}

export interface ProspectProvider {
  name: 'hunter'
  enrichDomain(domain: string): Promise<EnrichedCompany>
}

export type SendEmailResult = {
  messageId: string
  threadId: string
}

export type ReplyCheckResult = {
  hasReply: boolean
  replySnippet: string | null
  repliedAt: string | null
}

export interface EmailProvider {
  name: 'gmail'
  sendEmail(params: { to: string; subject: string; body: string }): Promise<SendEmailResult>
  checkReplies(threadId: string, sentMessageId: string): Promise<ReplyCheckResult>
}

export type CrmContactFields = {
  email: string
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  jobTitle?: string | null
}

export interface CrmProvider {
  name: 'hubspot'
  findContactByEmail(email: string): Promise<string | null>
  createContact(fields: CrmContactFields): Promise<string>
  updateContact(contactId: string, fields: Partial<CrmContactFields>): Promise<void>
  logNote(contactId: string, note: string): Promise<void>
}
