import { getCanonicalPropertyName } from '@/properties'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const AIRTABLE_CONTENT_API_URL = 'https://content.airtable.com/v0'
const TABLE_NAME = 'Data'
const FIELD_PDF = 'Day Passes Info Received'
const MAX_DIRECT_ATTACHMENT_BYTES = 5 * 1024 * 1024

const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required Airtable environment variable: ${name}`)
  return value
}

// Converts supported Lodgify date variants to Airtable's ISO representation.
export function toIsoDate(input: string): string {
  const value = input.trim()
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)

  if (isoMatch) {
    const [, year, month, day] = isoMatch
    validateDateParts(year, month, day, input)
    return `${year}-${month}-${day}T00:00:00Z`
  }

  const dateMatch = value.match(/^(\d{1,2})\s+([A-Za-z]+|\d{1,2})\s+(\d{4})$/)
  if (!dateMatch) {
    throw new Error(
      `Unrecognized date format "${input}". Expected "DD MMM YYYY" (for example, "09 Apr 2026").`
    )
  }

  const [, rawDay, rawMonth, year] = dateMatch
  const month = /^\d+$/.test(rawMonth)
    ? rawMonth.padStart(2, '0')
    : MONTHS[rawMonth.toLowerCase()]

  if (!month) {
    throw new Error(`Unrecognized month "${rawMonth}" in date "${input}".`)
  }

  const day = rawDay.padStart(2, '0')
  validateDateParts(year, month, day, input)
  return `${year}-${month}-${day}T00:00:00Z`
}

function validateDateParts(year: string, month: string, day: string, input: string): void {
  const candidate = new Date(`${year}-${month}-${day}T00:00:00Z`)
  const isValid =
    !Number.isNaN(candidate.getTime()) &&
    candidate.getUTCFullYear() === Number(year) &&
    candidate.getUTCMonth() + 1 === Number(month) &&
    candidate.getUTCDate() === Number(day)

  if (!isValid) {
    throw new Error(`Invalid calendar date "${input}".`)
  }
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
    Authorization: `Bearer ${getRequiredEnv('AIRTABLE_API_KEY')}`,
    'Content-Type': 'application/json',
  }
}

async function searchRecords(formula: string, maxRecords = 1): Promise<string[]> {
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID')
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
  pdfBuffer: Buffer,
  filename: string,
  guestEmail: string,
  guestName: string,
  propertyName: string,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  const baseId = getRequiredEnv('AIRTABLE_BASE_ID')
  const recordId = await findRecordId(guestEmail, guestName, propertyName, checkIn, checkOut, reservationNumber)

  if (pdfBuffer.byteLength > MAX_DIRECT_ATTACHMENT_BYTES) {
    throw new Error(
      `Generated PDF is ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB; Airtable direct attachment upload limit is 5 MB.`
    )
  }

  // Use Airtable's direct attachment upload endpoint instead of giving Airtable a
  // temporary app URL. The previous URL-based flow depended on Airtable fetching
  // /api/pdf later, while the app deleted the blob after serving it; that made the
  // attachment fragile and left clients uploading the PDF manually.
  const url = `${AIRTABLE_CONTENT_API_URL}/${baseId}/${recordId}/${encodeURIComponent(FIELD_PDF)}/uploadAttachment`
  const body = JSON.stringify({
    contentType: 'application/pdf',
    file: pdfBuffer.toString('base64'),
    filename,
  })

  const res = await fetch(url, { method: 'POST', headers: headers(), body })
  if (!res.ok) throw new Error(`Airtable attachment upload failed: ${await res.text()}`)
}
