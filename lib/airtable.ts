// Uses Airtable REST API directly to avoid SDK TypeScript type conflicts
// Airtable requires a publicly accessible URL for attachments.
// In production, APP_URL must be the public domain (e.g. https://yourdomain.com).

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_NAME = 'Data_Test'
const FIELD_PDF = 'Day Passes Info Received'
const FIELD_RESERVATION = 'Reservation number'

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function findRecordId(reservationNumber: string): Promise<string> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const filterFormula = encodeURIComponent(`{${FIELD_RESERVATION}} = "${reservationNumber}"`)
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${filterFormula}&maxRecords=1`

  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Airtable search failed: ${await res.text()}`)

  const json = await res.json()
  if (!json.records || json.records.length === 0) {
    throw new Error(`No record found in Airtable for reservation ${reservationNumber}`)
  }
  return json.records[0].id as string
}

export async function uploadPdfToAirtable(
  reservationNumber: string,
  pdfBuffer: Buffer,
  filename: string,
  publicPdfUrl: string
): Promise<void> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const recordId = await findRecordId(reservationNumber)

  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`
  const body = JSON.stringify({
    fields: {
      [FIELD_PDF]: [{ url: publicPdfUrl, filename }],
    },
  })

  const res = await fetch(url, { method: 'PATCH', headers: headers(), body })
  if (!res.ok) throw new Error(`Airtable update failed: ${await res.text()}`)
}
