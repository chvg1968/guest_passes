import { Resend } from 'resend'

interface SendGuestPassEmailParams {
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
  const conciergeEmail = process.env.CONCIERGE_EMAIL || 'concierge@bahiapr.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://guestpasses.netlify.app'
  const logoUrl = `${appUrl}/assets/logluxeproperties.png`
  const filename = `ResortPass-${propertyName.replace(/\s+/g, '')}-${reservationNumber.replace('#', '')}.pdf`

  const { data, error } = await resend.emails.send({
    from: 'Luxe Properties <noreply@mail.luxepropertiespr.com>',
    to: [conciergeEmail],
    subject: `Guest Pass Request – ${propertyName} | ${checkIn} – ${checkOut}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">

        <div style="padding: 32px 32px 16px; text-align: center;">
          <img src="${logoUrl}" alt="Luxe Properties" style="height: 120px; width: auto;" />
        </div>

        <div style="padding: 8px 32px 32px;">
          <p style="font-size: 15px; line-height: 1.7;">
            Please find attached the completed Guest Pass request form submitted by
            <strong>Luxe Properties</strong> for the following reservation.
          </p>

          <div style="background: #f9f7f4; border-left: 3px solid #c49a6c; padding: 16px 20px; margin: 24px 0; border-radius: 2px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 5px 0; color: #888; width: 120px;">Property</td><td style="padding: 5px 0;"><strong>${propertyName}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #888;">Guest</td><td style="padding: 5px 0;"><strong>${guestName}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #888;">Check-in</td><td style="padding: 5px 0;"><strong>${checkIn}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #888;">Check-out</td><td style="padding: 5px 0;"><strong>${checkOut}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #888;">Guests</td><td style="padding: 5px 0;"><strong>${adults} Adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} ${children !== 1 ? 'Children' : 'Child'}` : ''}</strong></td></tr>
              <tr><td style="padding: 5px 0; color: #888;">Reservation</td><td style="padding: 5px 0;"><strong>${reservationNumber}</strong></td></tr>
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.7; color: #555;">
            The signed pass document is attached to this email as a PDF. Please proceed
            with the issuance through the ID123 App accordingly.
          </p>

          <p style="margin-top: 32px; font-size: 14px; line-height: 1.6; color: #555;">
            Best regards,<br/>
            <strong>Luxe Properties</strong>
          </p>
        </div>

        <div style="background-color: #f0ede8; padding: 14px 32px; text-align: center; font-size: 11px; color: #aaa; letter-spacing: 0.5px;">
          LUXE PROPERTIES · BAHIA BEACH RESORT · RÍO GRANDE, PUERTO RICO
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
