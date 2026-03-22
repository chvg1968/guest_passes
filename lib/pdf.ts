import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import type { GuestInfo, ParsedReservation } from './claude'

interface PdfData extends ParsedReservation {
  ownerName: string
  signatureDataUrl: string
  signatureDate: string
}

function formatGuests(guests: GuestInfo[]): string {
  const rows: string[] = []

  // Always render 8 guest rows
  for (let i = 0; i < 8; i++) {
    const g = guests[i]
    rows.push(`
      <tr class="guest-row">
        <td class="label">Name of Guest:</td>
        <td class="value">${g?.name ?? ''}</td>
        <td class="label">Guest email:</td>
        <td class="value">${g?.email ?? ''}</td>
        <td class="label">Guest telephone:</td>
        <td class="value">${g?.phone ?? ''}</td>
      </tr>
    `)
  }

  return rows.join('')
}

export async function generateGuestPassPdf(data: PdfData): Promise<Buffer> {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11px;
      color: #1a1a1a;
      padding: 32px 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 17px;
      letter-spacing: 1px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .intro {
      font-size: 10px;
      line-height: 1.5;
      margin-bottom: 16px;
      text-align: justify;
      border: 1px solid #999;
      padding: 8px 10px;
      background: #fafaf8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .meta-row td {
      padding: 4px 6px;
      border: 1px solid #bbb;
      vertical-align: middle;
    }
    .meta-row .label {
      font-weight: bold;
      width: 18%;
      background: #f0f0eb;
    }
    .guest-row td {
      padding: 4px 6px;
      border: 1px solid #bbb;
      vertical-align: middle;
    }
    .guest-row .label {
      font-weight: bold;
      background: #f0f0eb;
      white-space: nowrap;
      width: 14%;
    }
    .guest-row .value {
      width: 18%;
    }
    .dates-row td {
      padding: 5px 8px;
      border: 1px solid #bbb;
    }
    .dates-row .label {
      font-weight: bold;
      background: #f0f0eb;
      width: 20%;
    }
    .footer-note {
      font-size: 9.5px;
      line-height: 1.5;
      margin: 12px 0 8px;
      font-style: italic;
      text-align: justify;
    }
    .signature-section table td {
      padding: 6px 8px;
      border: 1px solid #bbb;
      vertical-align: bottom;
    }
    .signature-section .label {
      font-weight: bold;
      background: #f0f0eb;
      width: 20%;
    }
    .sig-img {
      max-height: 50px;
      max-width: 220px;
    }
    .section-title {
      font-size: 10px;
      font-weight: bold;
      margin: 10px 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Resort Guest Pass Form</h1>
  </div>

  <div class="intro">
    The Club will approve a maximum of passes based on the villa type. A nightly resort flat fee will be
    charged per night. Rental guests must be registered by the member with the Membership Office at least
    72 hours prior to the visit. Form must be sent via email to concierge@bahiapr.com. Resort passes will
    be issued electronically to each guest over the age of 14 years old via email through ID123 App after
    payment of the passes is completed. If guests do not have their Resort Pass the Club will deny access.
    The Resort pass grants access to all Club amenities: Boat house, Tennis Courts, Wellness Center, Beach
    Club Pool, Aquavento and St. Regis Pool.
  </div>

  <table>
    <tr class="meta-row">
      <td class="label">Member's Name:</td>
      <td>${data.ownerName}</td>
      <td class="label">Unit Number:</td>
      <td>${data.propertyName}</td>
    </tr>
  </table>

  <div class="section-title">Guest Information</div>
  <table>
    ${formatGuests(data.guests)}
  </table>

  <table style="margin-top:6px;">
    <tr class="dates-row">
      <td class="label">Arrival Date:</td>
      <td>${data.checkIn}</td>
      <td class="label">Departure Date:</td>
      <td>${data.checkOut}</td>
    </tr>
    <tr class="dates-row">
      <td class="label"># of Nights:</td>
      <td>${data.nights}</td>
      <td class="label">Reservation #:</td>
      <td>${data.reservationNumber}</td>
    </tr>
    <tr class="dates-row">
      <td class="label">Form Request Received:</td>
      <td>${data.signatureDate}</td>
      <td class="label">Passes Delivered By:</td>
      <td></td>
    </tr>
  </table>

  <p class="footer-note">
    Although it is the intention of the Club to accommodate guests without inconvenience to the members,
    The Club reserves the right to limit the number of rental guests on any given day or over the course
    of the membership year or portion thereof.<br/><br/>
    I hereby (a) acknowledge receipt of the number of Resort Passes indicated above and (b) authorize
    the Club at Bahia Beach Resort to charge my account for (i) the Resort Nightly Fee set forth.
  </p>

  <div class="signature-section">
    <table>
      <tr>
        <td class="label">Member Signature:</td>
        <td>
          ${data.signatureDataUrl
            ? `<img src="${data.signatureDataUrl}" class="sig-img" alt="Signature" />`
            : ''}
        </td>
        <td class="label">Date:</td>
        <td>${data.signatureDate}</td>
      </tr>
    </table>
  </div>

</body>
</html>`

  const isLocal = process.env.NODE_ENV === 'development'

  const browser = await puppeteer.launch({
    args: isLocal ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: isLocal
      ? undefined // uses system Chrome in dev
      : await chromium.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfUint8 = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    return Buffer.from(pdfUint8)
  } finally {
    await browser.close()
  }
}
