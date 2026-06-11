import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Add your Anthropic API key to .env as VITE_ANTHROPIC_API_KEY')
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const EXPENSE_CATEGORIES = [
  'Housing', 'Utilities', 'Insurance', 'Marketing', 'Materials & Supplies',
  'Labor & Contractors', 'Professional Services', 'Software & Tech', 'Travel',
  'Meals & Entertainment', 'Vehicle & Transport', 'Office & Admin',
  'Taxes & Licenses', 'Loan Payments', 'Investment', 'Transfer', 'Income',
  'Wholesale Fees', 'Rental Income', 'Consulting Income', 'Other',
]

export async function categorizeTransactions(transactions) {
  const client = getClient()
  const rows = transactions
    .map((t, i) => `${i}: ${t.date} | ${t.description} | $${t.amount}`)
    .join('\n')

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Categorize these bank transactions. Return ONLY a JSON array of objects with "index" and "category" fields. Use one of these categories: ${EXPENSE_CATEGORIES.join(', ')}.

Transactions:
${rows}`,
      },
    ],
  })

  const text = msg.content[0].text
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Unexpected response format from AI')
  return JSON.parse(jsonMatch[0])
}

export async function readReceipt(base64Image, mimeType = 'image/jpeg') {
  const client = getClient()

  const isPDF = mimeType === 'application/pdf'

  // PDFs use the 'document' content block; images use 'image'
  const fileBlock = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Image } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64Image } }

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text: 'Extract receipt details. Return JSON with: { vendor, date, total, category, items: [{description, amount}] }. Use one of these categories: Materials & Supplies, Labor & Contractors, Tools & Equipment, Permits & Fees, Other.',
          },
        ],
      },
    ],
  })

  const text = msg.content[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse receipt')
  return JSON.parse(jsonMatch[0])
}
