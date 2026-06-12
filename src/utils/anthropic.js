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

export async function readCreditReport(base64Data, mimeType = 'application/pdf') {
  const client = getClient()
  const isPDF  = mimeType === 'application/pdf'

  const fileBlock = isPDF
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,           data: base64Data } }

  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        fileBlock,
        {
          type: 'text',
          text: `You are reading a credit report. Extract all available data and return ONLY valid JSON — no prose, no markdown, just the JSON object.

Return this exact structure:
{
  "reportDate": "YYYY-MM-DD or empty string if not found",
  "equifax":    score_number_or_null,
  "experian":   score_number_or_null,
  "transunion": score_number_or_null,
  "negatives": [
    {
      "creditor":          "name of creditor or collection agency",
      "type":              "one of: Collection, Late Payment, Charge-off, Bankruptcy, Repossession, Judgment, Tax Lien, Other",
      "bureaus":           ["Equifax","Experian","TransUnion"] — only bureaus where this item appears,
      "balance":           number_or_null,
      "status":            "brief status e.g. '120 days late', 'In collections', 'Charge-off'",
      "dateOpened":        "YYYY-MM-DD or empty string",
      "dateLastActivity":  "YYYY-MM-DD or empty string",
      "accountNumber":     "account number if visible, else empty string",
      "originalCreditor":  "original creditor name if this is a collection agency, else empty string",
      "address":           "creditor street address if listed on report, else empty string",
      "city":              "city if listed, else empty string",
      "state":             "state abbreviation if listed, else empty string",
      "zip":               "zip code if listed, else empty string",
      "phone":             "phone number if listed, else empty string"
    }
  ],
  "accounts": [
    {
      "name":    "account name",
      "limit":   number_or_null,
      "balance": number_or_null,
      "type":    "Revolving or Installment or Mortgage or Other"
    }
  ]
}

Rules:
- If only one bureau's score is visible, set the others to null
- Include ALL negative/derogatory items — late payments, collections, charge-offs, public records
- For accounts, only include revolving credit lines (credit cards, lines of credit) — skip loans/mortgages unless they have negative marks
- Return ONLY the JSON object, absolutely nothing else`,
        },
      ],
    }],
  })

  const text       = msg.content[0].text
  const jsonMatch  = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse credit report — try uploading a clearer image or the full PDF')
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
