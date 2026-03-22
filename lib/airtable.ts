const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_NAME = 'Data_Test'
const FIELD_PDF = 'Day Passes Info Received'

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function searchRecords(formula: string): Promise<string | null> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Airtable search failed: ${await res.text()}`)
  const json = await res.json()
  return json.records?.[0]?.id ?? null
}

async function findRecordId(guestEmail: string, guestName: string): Promise<string> {
  // 1st attempt: match by email (most precise)
  if (guestEmail) {
    const id = await searchRecords(`{E-mail} = "${guestEmail}"`)
    if (id) return id
  }

  // 2nd attempt: match by full name
  if (guestName) {
    const id = await searchRecords(`{Full Name} = "${guestName}"`)
    if (id) return id
  }

  throw new Error(
    `No Airtable record found for guest "${guestName}" (${guestEmail}). ` +
    `Make sure the guest has submitted the pre-arrival form.`
  )
}

export async function uploadPdfToAirtable(
  _reservationNumber: string,
  _pdfBuffer: Buffer,
  filename: string,
  publicPdfUrl: string,
  guestEmail: string,
  guestName: string,
): Promise<void> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const recordId = await findRecordId(guestEmail, guestName)

  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`
  const body = JSON.stringify({
    fields: {
      [FIELD_PDF]: [{ url: publicPdfUrl, filename }],
    },
  })

  const res = await fetch(url, { method: 'PATCH', headers: headers(), body })
  if (!res.ok) throw new Error(`Airtable update failed: ${await res.text()}`)
}
