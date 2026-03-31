import { Resend } from 'resend'
import nodemailer from 'nodemailer'

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

function getEmailProvider(email: string): 'resend' | 'outlook' {
  const domain = email.split('@')[1]?.toLowerCase()
  const outlookDomains = new Set(['bahiapr.com'])
  return outlookDomains.has(domain) ? 'outlook' : 'resend'
}

async function sendViaHostinger({
  to,
  subject,
  html,
  pdfBuffer,
  filename,
}: {
  to: string
  subject: string
  html: string
  pdfBuffer: Buffer
  filename: string
}) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_USER,
      pass: process.env.HOSTINGER_PASS,
    },
  })

  return transporter.sendMail({
    from: `"Luxe Properties" <${process.env.HOSTINGER_USER}>`,
    to,
    cc: 'luxeprbahia@gmail.com',
    subject,
    html,
    attachments: [{ filename, content: pdfBuffer }],
  })
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
  const conciergeEmail = process.env.CONCIERGE_EMAIL || 'concierge@bahiapr.com'
  const replyTo = process.env.REPLY_TO_EMAIL || 'reservations@luxepropertiespr.com'
  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://guestpasses.netlify.app/assets/logluxeproperties.png'

  const safeProperty = propertyName.replace(/[^a-zA-Z0-9]/g, '')
  const safeReservation = reservationNumber.replace(/[^a-zA-Z0-9]/g, '')
  const filename = `ResortPass-${safeProperty}-${safeReservation}.pdf`
  const guestLastName = guestName.trim().split(/\s+/).pop() ?? guestName
  const subject = `${guestLastName} - Resort Guest Pass - ${propertyName} | ${checkIn} - ${checkOut}`

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">

      <div style="padding: 32px 32px 16px; text-align: center;">
        <img src="${logoUrl}" alt="Luxe Properties" style="height: 120px;" />
      </div>

      <div style="padding: 8px 32px 32px;">
        <p style="font-size: 15px; line-height: 1.7;">Dear Concierge,</p>

        <p style="font-size: 15px; line-height: 1.7;">
          Attached is the completed Guest Pass form for this reservation.
        </p>

        <p style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #555;">
          Best regards,<br/>
          <strong>Luxe Properties</strong>
        </p>
      </div>

      <div style="background-color: #f0ede8; padding: 14px 32px; text-align: center; font-size: 11px; color: #aaa; letter-spacing: 0.5px;">
        LUXE PROPERTIES · BAHIA BEACH RESORT · RÍO GRANDE, PUERTO RICO
      </div>
    </div>
  `

  const provider = getEmailProvider(conciergeEmail)

  try {
    if (provider === 'outlook') {
      console.log('[email] Sending via Outlook to', conciergeEmail)
      return await sendViaHostinger({ to: conciergeEmail, subject, html, pdfBuffer, filename })
    }

    console.log('[email] Sending via Resend to', conciergeEmail)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: 'Luxe Properties <notifications@mail.luxepropertiespr.com>',
      to: [conciergeEmail],
      cc: ['luxeprbahia@gmail.com'],
      replyTo,
      subject,
      html,
      attachments: [{ filename, content: pdfBuffer.toString('base64') }],
    })

    if (error) throw error
    return data
  } catch (err) {
    console.error('[email] Primary provider failed, falling back to Outlook:', err)
    return await sendViaHostinger({ to: conciergeEmail, subject, html, pdfBuffer, filename })
  }
}
