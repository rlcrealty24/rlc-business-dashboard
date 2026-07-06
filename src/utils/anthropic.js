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
    model: 'claude-opus-4-8',
    max_tokens: 8192,
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
      "status":                "brief status e.g. '120 days late', 'In collections', 'Charge-off'",
      "dateOpened":            "YYYY-MM-DD or empty string",
      "dateFirstDelinquency":  "YYYY-MM-DD — the date of first delinquency (DOFD), critical for 7-year fall-off calculation. Look for 'Date of First Delinquency', 'DOFD', 'First Delinquency', or 'Delinquency Date' on the report. Empty string if not found.",
      "dateLastActivity":      "YYYY-MM-DD or empty string",
      "accountNumber":         "account number if visible, else empty string",
      "originalCreditor":      "original creditor name if this is a collection agency, else empty string",
      "address":               "creditor/collection agency mailing address street if listed on report, else empty string",
      "city":                  "city if listed, else empty string",
      "state":                 "state abbreviation if listed, else empty string",
      "zip":                   "zip code if listed, else empty string",
      "phone":                 "phone number if listed, else empty string"
    }
  ],
  "accounts": [
    {
      "name":    "account name",
      "limit":   number_or_null,
      "balance": number_or_null,
      "type":    "Revolving or Installment or Mortgage or Other"
    }
  ],
  "inquiries": [
    {
      "creditor": "name of the company that pulled credit",
      "bureau":   "Equifax or Experian or TransUnion — which bureau was pulled",
      "date":     "YYYY-MM-DD — date the inquiry was made",
      "type":     "Hard or Soft"
    }
  ]
}

Rules:
- If only one bureau's score is visible, set the others to null
- Include ALL negative/derogatory items — late payments, collections, charge-offs, public records
- For accounts, only include revolving credit lines (credit cards, lines of credit) — skip loans/mortgages unless they have negative marks
- For inquiries, include ALL hard inquiries found — these are the most important. Also include soft inquiries if listed, marked as type "Soft". Hard inquiries appear in sections labeled "Inquiries", "Credit Inquiries", "Hard Inquiries", "Requests for Your Credit History", etc.
- Return ONLY the JSON object, absolutely nothing else`,
        },
      ],
    }],
  })

  const text = msg.content[0].text

  // Strip markdown fences if model wrapped the JSON anyway
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // 1. Try a complete JSON object match first
  const completeMatch = stripped.match(/\{[\s\S]*\}/)
  if (completeMatch) {
    try { return JSON.parse(completeMatch[0]) } catch {}
  }

  // 2. Try from first { to end (handles truncated response)
  const startIdx = stripped.indexOf('{')
  if (startIdx === -1) throw new Error('Could not parse credit report — try uploading a clearer image or the full PDF')

  let raw = stripped.slice(startIdx)

  // Strip trailing incomplete token: mid-string, mid-number, or trailing comma
  raw = raw
    .replace(/,\s*$/, '')
    .replace(/:\s*"[^"]*$/, ': ""')
    .replace(/:\s*-?[0-9.]*$/, ': null')

  // Close any unclosed brackets (skipping brackets inside strings)
  const opens = []
  let inStr = false, esc = false
  for (const ch of raw) {
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{' || ch === '[') opens.push(ch)
    else if (ch === '}' || ch === ']') opens.pop()
  }
  for (let i = opens.length - 1; i >= 0; i--) {
    raw += opens[i] === '{' ? '}' : ']'
  }

  try {
    return JSON.parse(raw)
  } catch {
    console.error('Credit report parse failed. Raw response:', text.slice(0, 500))
    throw new Error('Could not parse credit report — the file may be too large or scanned at low quality. Try a text-based PDF.')
  }
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
