import { NextRequest, NextResponse } from 'next/server'
import { parseLodgifyText } from '@/lib/claude'
import { getOwnerByProperty } from '@/properties'
import { includeReservationHolder } from '@/lib/guests'

function getClientSafeParseError(message: string) {
  if (message.includes('Incorrect API key') || message.includes('API key')) {
    return 'The AI parser is not configured correctly. Please verify the OpenAI API key in the server environment and redeploy.'
  }

  if (message.includes('credit balance is too low')) {
    return 'The AI parser provider does not have enough credits. Please update billing or configure another provider.'
  }

  return 'Failed to parse reservation text. Please try again or contact support if the issue continues.'
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return NextResponse.json({ error: 'Text is too short or empty.' }, { status: 400 })
    }

    const parsed = await parseLodgifyText(text)

    // Put the booking contact first, then preserve the order of the other guests.
    const validGuests = includeReservationHolder(parsed.guests ?? [], parsed.reservationHolder)
    if (validGuests.length === 0) {
      return NextResponse.json(
        {
          error:
            'No guest name could be extracted. Please ensure the reservation includes a named booking contact or a completed check-in form.',
        },
        { status: 422 }
      )
    }

    // Look up owner from properties map
    const ownerName = getOwnerByProperty(parsed.propertyName)

    return NextResponse.json({ ...parsed, guests: validGuests, ownerName })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse] ERROR:', message)
    return NextResponse.json(
      { error: getClientSafeParseError(message) },
      { status: 500 }
    )
  }
}
