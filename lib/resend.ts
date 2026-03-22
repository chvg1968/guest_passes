import { Resend } from 'resend'

interface SendGuestPassEmailParams {
  guestEmail: string
  guestName: string
  propertyName: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  pdfBuffer: Buffer
  reservationNumber: string
}

export async function sendGuestPassEmail({
  guestEmail,
  guestName,
  propertyName,
  checkIn,
  checkOut,
  adults,
  children,
  pdfBuffer,
  reservationNumber,
}: SendGuestPassEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const firstName = guestName.split(' ')[0]
  const conciergeEmail = process.env.CONCIERGE_EMAIL || 'concierge@bahiapr.com'
  const filename = `ResortPass-${propertyName.replace(/\s+/g, '')}-${reservationNumber.replace('#', '')}.pdf`

  const { data, error } = await resend.emails.send({
    from: 'Bahia Beach Concierge <noreply@mail.luxepropertiespr.com>',
    to: [guestEmail],
    cc: [conciergeEmail],
    subject: `Your Bahia Beach Resort Guest Pass – ${propertyName} | ${checkIn} – ${checkOut}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">
        <div style="background-color: #1a3a2a; padding: 24px 32px; text-align: center;">
          <h1 style="color: #d4af37; margin: 0; font-size: 22px; letter-spacing: 2px;">BAHIA BEACH RESORT & GOLF CLUB</h1>
          <p style="color: #a0c0a0; margin: 6px 0 0; font-size: 13px; letter-spacing: 1px;">CONCIERGE SERVICES</p>
        </div>

        <div style="padding: 32px;">
          <p style="font-size: 16px;">Dear ${firstName},</p>

          <p style="line-height: 1.7;">
            Please find attached your <strong>Resort Guest Pass</strong> for your upcoming stay at
            <strong>${propertyName}</strong>, Bahia Beach Resort.
          </p>

          <p style="line-height: 1.7;">
            Your pass has been registered with the Membership Office and grants access to all Club amenities:
            Beach Club Pool, Aquavento, St. Regis Pool, Boat House, Tennis Courts, and Wellness Center.
          </p>

          <div style="background: #f5f5f0; border-left: 4px solid #d4af37; padding: 16px 20px; margin: 24px 0; border-radius: 2px;">
            <p style="margin: 0 0 8px; font-weight: bold; color: #1a3a2a; font-size: 14px; letter-spacing: 1px;">STAY DETAILS</p>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #666;">Property</td><td style="padding: 4px 0;"><strong>${propertyName}</strong></td></tr>
              <tr><td style="padding: 4px 0; color: #666;">Check-in</td><td style="padding: 4px 0;"><strong>${checkIn}</strong></td></tr>
              <tr><td style="padding: 4px 0; color: #666;">Check-out</td><td style="padding: 4px 0;"><strong>${checkOut}</strong></td></tr>
              <tr><td style="padding: 4px 0; color: #666;">Guests</td><td style="padding: 4px 0;"><strong>${adults} Adults${children > 0 ? `, ${children} Children` : ''}</strong></td></tr>
            </table>
          </div>

          <p style="line-height: 1.7; font-size: 14px; color: #555;">
            <strong>Important:</strong> Resort passes will be issued electronically via the <strong>ID123 App</strong>
            after payment is completed. Guests without their Resort Pass will be denied access.
          </p>

          <p style="line-height: 1.7;">
            For questions, please contact us at
            <a href="mailto:${conciergeEmail}" style="color: #1a3a2a;">${conciergeEmail}</a>.
          </p>

          <p style="margin-top: 32px;">We look forward to welcoming you!</p>

          <p style="margin-top: 24px; line-height: 1.6;">
            Warm regards,<br/>
            <strong>Concierge Team</strong><br/>
            Bahia Beach Resort &amp; Golf Club<br/>
            <a href="mailto:${conciergeEmail}" style="color: #1a3a2a;">${conciergeEmail}</a>
          </p>
        </div>

        <div style="background-color: #f0f0eb; padding: 16px 32px; text-align: center; font-size: 11px; color: #888;">
          Bahia Beach Resort &amp; Golf Club · Rio Grande, Puerto Rico
        </div>
      </div>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`)
  return data
}
