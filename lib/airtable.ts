import { getCanonicalPropertyName } from '@/properties'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_NAME = 'Data'
const FIELD_PDF = 'Day Passes Info Received'

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

// Converts "09 Apr 2026" → "2026-04-09T00:00:00Z"
function toIsoDate(ddMmmYyyy: string): string {
  const [dd, mmm, yyyy] = ddMmmYyyy.split(' ')
  return `${yyyy}-${MONTHS[mmm]}-${dd.padStart(2, '0')}T00:00:00Z`
}

// Builds the dupKey used in Airtable: "firstName|propertyName|checkInISO|checkOutISO"
// El propertyName se normaliza al nombre canónico de properties.ts (Lodgify a veces invierte
// el orden, p.ej. "Villa Clara 3325" en lugar de "3325 Villa Clara").
function buildDupKey(name: string, propertyName: string, checkIn: string, checkOut: string): string {
  const firstName = name.split(' ')[0].toLowerCase()
  const canonicalProperty = getCanonicalPropertyName(propertyName)
  return `${firstName}|${canonicalProperty}|${toIsoDate(checkIn)}|${toIsoDate(checkOut)}`
}

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

async function findRecordId(
  guestEmail: string,
  guestName: string,
  propertyName: string,
  checkIn: string,
  checkOut: string,
  reservationNumber: string,
): Promise<string> {
  // El filtro por año sólo se aplica a los matches ambiguos (full name / email),
  // donde un huésped recurrente podría tener varios registros. dupKey y Key ya son únicos
  // por sí mismos (incluyen fechas o número de reserva), así que añadir YEAR({Arrival})
  // sólo introduce falsos negativos cuando {Arrival} está vacío en Airtable.
  const checkInYear = checkIn.split(' ')[2] // "09 Apr 2026" → "2026"
  const yearFilter = `YEAR({Arrival}) = ${checkInYear}`

  // 1st attempt: dupKey (incluye nombre, propiedad y fechas — único)
  const dupKey = buildDupKey(guestName, propertyName, checkIn, checkOut)
  const idByDupKey = await searchRecords(`{dupKey} = "${dupKey}"`)
  if (idByDupKey) return idByDupKey

  // 2nd attempt: Key (registros antiguos usan Key con el número de reserva embebido — único)
  const reservationClean = reservationNumber.replace(/^#/, '')
  if (reservationClean) {
    const id = await searchRecords(`FIND("${reservationClean}", {Key}) > 0`)
    if (id) return id
  }

  // 3rd attempt: año + full name (desambigua huéspedes recurrentes)
  if (guestName) {
    const id = await searchRecords(`AND(${yearFilter}, {Full Name} = "${guestName}")`)
    if (id) return id
  }

  // 4th attempt: año + email
  if (guestEmail) {
    const id = await searchRecords(`AND(${yearFilter}, {E-mail} = "${guestEmail}")`)
    if (id) return id
  }

  throw new Error(
    `No Airtable record found for guest "${guestName}" (${guestEmail}) — dupKey: ${dupKey}. ` +
    `Make sure the guest has submitted the pre-arrival form.`
  )
}

export async function uploadPdfToAirtable(
  reservationNumber: string,
  _pdfBuffer: Buffer,
  filename: string,
  publicPdfUrl: string,
  guestEmail: string,
  guestName: string,
  propertyName: string,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const recordId = await findRecordId(guestEmail, guestName, propertyName, checkIn, checkOut, reservationNumber)

  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`
  const body = JSON.stringify({
    fields: {
      [FIELD_PDF]: [{ url: publicPdfUrl, filename }],
    },
  })

  const res = await fetch(url, { method: 'PATCH', headers: headers(), body })
  if (!res.ok) throw new Error(`Airtable update failed: ${await res.text()}`)
}
