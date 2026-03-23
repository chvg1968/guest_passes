import { GoogleGenerativeAI } from '@google/generative-ai'

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
  guests: GuestInfo[]
}

export async function parseLodgifyText(text: string): Promise<ParsedReservation> {
  const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `You are a data extraction assistant. Extract reservation information from the following Lodgify booking text and return ONLY a valid JSON object with no extra text.

Extract:
- reservationNumber: The booking/reservation number (format: #XXXXXXXX, include the #)
- propertyName: The villa/property name and unit number (e.g. "2-105 Ocean Grace Villa", "7256 Villa Palacio"). Extract the unit number + villa name exactly as it appears. If the name ends with a section/community label such as "Verandas", "Ventanas", or "Atlantic", remove that trailing word — only keep the villa name itself.
- checkIn: Check-in date in format "DD MMM YYYY" (e.g. "20 Mar 2026")
- checkOut: Check-out date in format "DD MMM YYYY"
- nights: Number of nights as integer
- adults: Number of adults as integer
- children: Number of children as integer
- guests: Array of guest objects extracted from the "Check-in form" section. Each guest must have:
  - name: Full name
  - email: Email address (empty string if not found)
  - phone: Phone number (empty string if not found)

Rules for guest extraction:
- Extract guests ONLY from the section that appears after "Check-in form" and "Completed"
- The primary guest (booker) is typically listed first
- Parse lines like "Full Name email@example.com 305-123-4567" or "Full Name\nemail@example.com\n305-123-4567"
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
  "guests": [
    { "name": "Full Name", "email": "email@example.com", "phone": "+1234567890" }
  ]
}

Lodgify text:
---
${text}
---`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Gemini response')

  return JSON.parse(jsonMatch[0]) as ParsedReservation
}
