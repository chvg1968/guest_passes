import { NextRequest, NextResponse } from 'next/server'
import { generateGuestPassPdf } from '@/lib/pdf'
import { sendGuestPassEmail } from '@/lib/resend'
import { uploadPdfToAirtable } from '@/lib/airtable'
import type { ParsedReservation } from '@/lib/claude'
import { includeReservationHolder } from '@/lib/guests'

interface SubmitBody extends ParsedReservation {
  ownerName: string
  signatureDataUrl: string
}

export async function POST(req: NextRequest) {
  try {
    const body: SubmitBody = await req.json()
    const { reservationNumber, propertyName, checkIn, checkOut, nights, adults, children, reservationHolder, guests, ownerName, signatureDataUrl } = body

    console.log('[submit] parsed reservation:', JSON.stringify({
      reservationNumber, propertyName, checkIn, checkOut, nights,
      reservationHolder: reservationHolder ? { name: reservationHolder.name, email: reservationHolder.email } : null,
      guestCount: guests.length,
    }))

    if (!signatureDataUrl || signatureDataUrl.trim().length === 0) {
      return NextResponse.json({ error: 'Concierge signature is required.' }, { status: 400 })
    }

    const passGuests = includeReservationHolder(guests ?? [], reservationHolder)
    const primaryGuest = passGuests[0]
    if (!primaryGuest) {
      return NextResponse.json(
        { error: 'At least one guest name is required.' },
        { status: 400 }
      )
    }

    const signatureDate = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    const filename = `ResortPass-${propertyName.replace(/\s+/g, '')}-${reservationNumber.replace('#', '')}.pdf`

    // 1. Generate PDF
    const pdfBuffer = await generateGuestPassPdf({
      reservationNumber, propertyName, checkIn, checkOut,
      nights, adults, children, guests: passGuests, ownerName,
      signatureDataUrl, signatureDate,
    })

    // 2. Send email unless this process was explicitly started in Airtable-only test mode.
    // This flag is server-side only and cannot be enabled by a client request.
    const skipEmail = process.env.SKIP_GUEST_PASS_EMAIL === 'true'
    if (skipEmail) {
      console.warn('[submit] SKIP_GUEST_PASS_EMAIL=true; email delivery skipped')
    } else {
      await sendGuestPassEmail({
        guestName: primaryGuest.name,
        propertyName, checkIn, checkOut,
        adults, children, pdfBuffer, reservationNumber, reservationHolder,
      })
    }

    // 3. Upload PDF bytes directly to Airtable
    let airtableWarning: string | null = null
    try {
      // Use reservationHolder (from booking header) for Airtable lookup.
      const airtableGuest = reservationHolder ?? primaryGuest
      await uploadPdfToAirtable(reservationNumber, pdfBuffer, filename, airtableGuest.email, airtableGuest.name, propertyName, checkIn, checkOut)
    } catch (airtableErr) {
      const msg = airtableErr instanceof Error ? airtableErr.message : String(airtableErr)
      console.error('[submit] Airtable upload failed:', msg)
      airtableWarning = skipEmail
        ? `Email skipped for this test, but Airtable upload failed: ${msg}`
        : `Email sent successfully, but Airtable upload failed: ${msg}`
    }

    return NextResponse.json({
      success: true,
      ...(skipEmail ? { emailSkipped: true } : {}),
      ...(airtableWarning ? { warning: airtableWarning } : {}),
    })
  } catch (err) {
    console.error('[submit]', err)
    return NextResponse.json(
      { error: 'Failed to process submission. Please try again.' },
      { status: 500 }
    )
  }
}
