import Anthropic from '@anthropic-ai/sdk'

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

export async function parseLodgifyText(text: string): Promise<ParsedReservation> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are a data extraction assistant. Extract reservation information from the following Lodgify booking text and return ONLY a valid JSON object with no extra text.

Extract:
- reservationNumber: The booking/reservation number (format: #XXXXXXXX, include the #)
- propertyName: The villa/property name and unit number (e.g. "2-105 Ocean Grace Villa", "7256 Villa Palacio"). Extract the unit number + villa name exactly as it appears. If the name ends with a section/community label such as "Verandas", "Ventanas", or "Atlantic", remove that trailing word — only keep the villa name itself.
- checkIn: Check-in date in format "DD MMM YYYY" (e.g. "20 Mar 2026")
- checkOut: Check-out date in format "DD MMM YYYY"
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

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Claude response')

  return JSON.parse(jsonMatch[0]) as ParsedReservation
}
