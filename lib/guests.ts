import type { GuestInfo } from './claude'

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function includeReservationHolder(guests: GuestInfo[], reservationHolder?: GuestInfo): GuestInfo[] {
  const listedGuests = guests.filter((guest) => guest.name?.trim())
  if (!reservationHolder?.name?.trim()) return listedGuests

  const holderName = normalizeName(reservationHolder.name)
  const holderEmail = reservationHolder.email?.trim().toLowerCase()
  const matchIndex = listedGuests.findIndex((guest) =>
    normalizeName(guest.name) === holderName ||
    (!!holderEmail && guest.email?.trim().toLowerCase() === holderEmail)
  )

  if (matchIndex === -1) return [reservationHolder, ...listedGuests]

  const matchedGuest = listedGuests[matchIndex]
  const primaryGuest = {
    ...matchedGuest,
    email: matchedGuest.email?.trim() || reservationHolder.email || '',
    phone: matchedGuest.phone?.trim() || reservationHolder.phone || '',
  }
  return [primaryGuest, ...listedGuests.filter((_, index) => index !== matchIndex)]
}
