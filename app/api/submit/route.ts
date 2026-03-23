import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { generateGuestPassPdf } from '@/lib/pdf'
import { sendGuestPassEmail } from '@/lib/resend'
import { uploadPdfToAirtable } from '@/lib/airtable'
import type { ParsedReservation } from '@/lib/claude'

interface SubmitBody extends ParsedReservation {
  ownerName: string
  signatureDataUrl: string
}

export async function POST(req: NextRequest) {
  try {
    const body: SubmitBody = await req.json()
    const { reservationNumber, propertyName, checkIn, checkOut, nights, adults, children, guests, ownerName, signatureDataUrl } = body

    if (!signatureDataUrl || signatureDataUrl.trim().length === 0) {
      return NextResponse.json({ error: 'Concierge signature is required.' }, { status: 400 })
    }

    const primaryGuest = guests.find((g) => g.name && g.name.trim().length > 0)
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
      nights, adults, children, guests, ownerName,
      signatureDataUrl, signatureDate,
    })

    // 2. Send email to concierge with PDF attached
    await sendGuestPassEmail({
      guestName: primaryGuest.name,
      propertyName, checkIn, checkOut,
      adults, children, pdfBuffer, reservationNumber,
    })

    // 3. Store PDF and upload URL to Airtable
    let airtableWarning: string | null = null
    try {
      const token = randomUUID()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const publicPdfUrl = `${appUrl}/api/pdf?token=${token}`

      if (process.env.NODE_ENV === 'production') {
        // Netlify Blobs — persists for Airtable to fetch (5 min TTL)
        const { getStore } = await import('@netlify/blobs')
        const store = getStore('pdf-temp')
        const ab = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength)
        await store.set(token, ab as ArrayBuffer)
      } else {
        // Local dev — write to /tmp
        fs.writeFileSync(path.join('/tmp', `${token}.pdf`), pdfBuffer)
      }

      await uploadPdfToAirtable(reservationNumber, pdfBuffer, filename, publicPdfUrl, primaryGuest.email, primaryGuest.name)
    } catch (airtableErr) {
      const msg = airtableErr instanceof Error ? airtableErr.message : String(airtableErr)
      console.error('[submit] Airtable upload failed:', msg)
      airtableWarning = `Email sent successfully, but Airtable upload failed: ${msg}`
    }

    return NextResponse.json({
      success: true,
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
