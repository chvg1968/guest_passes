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

async function searchRecords(formula: string, maxRecords = 1): Promise<string[]> {
  const baseId = process.env.AIRTABLE_BASE_ID!
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=${maxRecords}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Airtable search failed: ${await res.text()}`)
  const json = await res.json()
  return (json.records ?? []).map((r: { id: string }) => r.id)
}

async function findRecordId(
  guestEmail: string,
  guestName: string,
  propertyName: string,
  checkIn: string,
  checkOut: string,
  reservationNumber: string,
): Promise<string> {
  // Los fallbacks por nombre/email se anclan a la fecha exacta de llegada (no al año),
  // porque un huésped recurrente puede tener varias reservas el mismo año y `maxRecords=1`
  // sin orden definido aplicaba el PDF a la reserva equivocada.
  const checkInIso = toIsoDate(checkIn)
  const arrivalFilter = `IS_SAME({Arrival}, '${checkInIso}', 'day')`

  // 1st attempt: dupKey (incluye nombre, propiedad y fechas — único)
  const dupKey = buildDupKey(guestName, propertyName, checkIn, checkOut)
  const idsByDupKey = await searchRecords(`{dupKey} = "${dupKey}"`)
  if (idsByDupKey[0]) return idsByDupKey[0]

  // 2nd attempt: Key (registros antiguos usan Key con el número de reserva embebido — único)
  const reservationClean = reservationNumber.replace(/^#/, '')
  if (reservationClean) {
    const ids = await searchRecords(`FIND("${reservationClean}", {Key}) > 0`)
    if (ids[0]) return ids[0]
  }

  // 3rd attempt: full name + fecha de llegada exacta. Pedimos hasta 2 matches para detectar
  // ambigüedad: si dos registros coinciden, fallamos en lugar de adivinar.
  if (guestName) {
    const ids = await searchRecords(`AND({Full Name} = "${guestName}", ${arrivalFilter})`, 2)
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous Airtable match for "${guestName}" arriving ${checkIn}: ${ids.length} records share the same name and arrival date. Refusing to upload PDF to avoid attaching it to the wrong reservation.`
      )
    }
    if (ids[0]) return ids[0]
  }

  // 4th attempt: email + fecha de llegada exacta (mismo criterio anti-ambigüedad)
  if (guestEmail) {
    const ids = await searchRecords(`AND({E-mail} = "${guestEmail}", ${arrivalFilter})`, 2)
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous Airtable match for ${guestEmail} arriving ${checkIn}: ${ids.length} records share the same email and arrival date.`
      )
    }
    if (ids[0]) return ids[0]
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
