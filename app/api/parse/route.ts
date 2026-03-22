import { NextRequest, NextResponse } from 'next/server'
import { parseLodgifyText } from '@/lib/claude'
import { getOwnerByProperty } from '@/properties'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return NextResponse.json({ error: 'Text is too short or empty.' }, { status: 400 })
    }

    const parsed = await parseLodgifyText(text)

    // Validate that at least one guest with a name was extracted
    const validGuests = parsed.guests.filter((g) => g.name.trim().length > 0)
    if (validGuests.length === 0) {
      return NextResponse.json(
        {
          error:
            'No guest information could be extracted. Please ensure the text includes the completed Check-in form section with at least one guest name.',
        },
        { status: 422 }
      )
    }

    // Look up owner from properties map
    const ownerName = getOwnerByProperty(parsed.propertyName)

    return NextResponse.json({ ...parsed, guests: validGuests, ownerName })
  } catch (err) {
    console.error('[parse]', err)
    return NextResponse.json(
      { error: 'Failed to parse reservation text. Please try again.' },
      { status: 500 }
    )
  }
}
