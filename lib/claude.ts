import Anthropic from '@anthropic-ai/sdk'

const OPENAI_MODEL = process.env.OPENAI_LODGIFY_MODEL || 'gpt-5.4-mini'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_LODGIFY_MODEL || 'claude-haiku-4-5-20251001'
const MAX_OUTPUT_TOKENS = 1024

export interface GuestInfo {
  name: string
  email: string
  phone: string
}

export interface ParsedReservation {
  reservationNumber: string
  propertyName: string
  checkIn: string
  checkOut: string
  nights: number
  adults: number
  children: number
  reservationHolder?: GuestInfo
  guests: GuestInfo[]
}

function buildPrompt(text: string) {
  return `You are a data extraction assistant. Extract reservation information from the following Lodgify booking text and return ONLY a valid JSON object with no extra text.

Extract:
- reservationNumber: The booking/reservation number (format: #XXXXXXXX, include the #)
- propertyName: The villa/property name and unit number (e.g. "2-105 Ocean Grace Villa", "7256 Villa Palacio"). Extract the unit number + villa name exactly as it appears. If the name ends with a section/community label such as "Verandas", "Ventanas", or "Atlantic", remove that trailing word; only keep the villa name itself.
- checkIn: Check-in date in format "DD MMM YYYY" (e.g. "20 Mar 2026")
- checkOut: Check-out date in format "DD MMM YYYY"

IMPORTANT - Date format rules:
- Lodgify ALWAYS prints dates as "D MMM YYYY" with the month abbreviated in English (e.g. "2 May 2026", "11 Jun 2026", "20 Mar 2026"). The day comes FIRST, then the month name, then the year.
- The check-in and check-out appear together separated by an arrow, e.g. "2 May 2026 -> 9 May 2026".
- NEVER assume MM/DD/YYYY or any numeric format; Lodgify does not use numeric dates in this section. If you see a date with the month written as a name, the number before it is the DAY, never the month.
- Copy the day and year verbatim from the source. Only zero-pad single-digit days (e.g. "2 May 2026" -> "02 May 2026"). Do not change the month or year.
- nights: Number of nights as integer
- adults: Number of adults as integer
- children: Number of children as integer
- reservationHolder: The person who made the booking, taken from the top "Guest" section of the reservation (the header area, NOT the check-in form). Extract:
  - name: Full name from the "Name" field in the Guest section
  - email: Email from the "Email" field in the Guest section (empty string if not found)
  - phone: Phone from the "Phone" field in the Guest section (empty string if not found)
- guests: Array of guest objects extracted from the "Check-in form" section. Each guest must have:
  - name: Full name
  - email: Email address (empty string if not found)
  - phone: Phone number (empty string if not found)

Rules for guest extraction:
- Extract guests ONLY from the section that appears after "Check-in form" and "Completed"
- Parse lines like "Full Name email@example.com 305-123-4567" or "Full Name\\nemail@example.com\\n305-123-4567"
- If a guest has no email, set email to ""
- If a guest has no phone, set phone to ""
- Do NOT include guests with no name at all

Return ONLY this JSON structure with no markdown fences:
{
  "reservationNumber": "#XXXXXXXX",
  "propertyName": "unit + villa name",
  "checkIn": "DD MMM YYYY",
  "checkOut": "DD MMM YYYY",
  "nights": 5,
  "adults": 4,
  "children": 4,
  "reservationHolder": { "name": "Full Name", "email": "email@example.com", "phone": "+1234567890" },
  "guests": [
    { "name": "Full Name", "email": "email@example.com", "phone": "+1234567890" }
  ]
}

Lodgify text:
---
${text}
---`
}

function parseReservationJson(responseText: string, provider: string): ParsedReservation {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON found in ${provider} response`)

  return JSON.parse(jsonMatch[0]) as ParsedReservation
}

function extractOpenAIText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  const record = value as Record<string, unknown>
  const directText = record.output_text
  if (typeof directText === 'string') return directText

  const parts: string[] = []
  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      for (const child of item) {
        const childText = extractOpenAIText(child)
        if (childText) parts.push(childText)
      }
    } else if (item && typeof item === 'object') {
      const nestedText = extractOpenAIText(item)
      if (nestedText) parts.push(nestedText)
    }
  }

  const text = record.text
  if (typeof text === 'string') parts.push(text)

  return parts.join('\n')
}

async function parseWithOpenAI(prompt: string): Promise<ParsedReservation> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    }),
  })

  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const errorBody = body && typeof body === 'object' ? (body as Record<string, unknown>).error : null
    const errorMessage =
      errorBody && typeof errorBody === 'object' && typeof (errorBody as Record<string, unknown>).message === 'string'
        ? (errorBody as Record<string, unknown>).message
        : response.statusText

    throw new Error(`OpenAI ${OPENAI_MODEL} failed: ${errorMessage}`)
  }

  return parseReservationJson(extractOpenAIText(body), `OpenAI ${OPENAI_MODEL}`)
}

async function parseWithAnthropic(prompt: string): Promise<ParsedReservation> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  return parseReservationJson(responseText, `Anthropic ${ANTHROPIC_MODEL}`)
}

export async function parseLodgifyText(text: string): Promise<ParsedReservation> {
  const prompt = buildPrompt(text)

  try {
    return await parseWithOpenAI(prompt)
  } catch (openAIError) {
    const openAIMessage = openAIError instanceof Error ? openAIError.message : String(openAIError)
    console.warn('[parse] Primary OpenAI parser failed. Falling back to Anthropic:', openAIMessage)

    try {
      return await parseWithAnthropic(prompt)
    } catch (anthropicError) {
      const anthropicMessage = anthropicError instanceof Error ? anthropicError.message : String(anthropicError)

      throw new Error(
        `Both AI parsers failed. Primary OpenAI error: ${openAIMessage}. Fallback Anthropic error: ${anthropicMessage}`
      )
    }
  }
}
