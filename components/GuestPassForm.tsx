'use client'

import type { GuestInfo, ParsedReservation } from '@/lib/claude'

interface FormData extends ParsedReservation {
  ownerName: string
}

interface GuestPassFormProps {
  data: FormData
  onChange: (data: FormData) => void
}

function GuestRow({
  index,
  guest,
  onGuestChange,
}: {
  index: number
  guest: GuestInfo
  onGuestChange: (index: number, field: keyof GuestInfo, value: string) => void
}) {
  const isEmpty = !guest.name && !guest.email && !guest.phone
  return (
    <div className={`grid grid-cols-3 gap-3 p-3 rounded-lg ${isEmpty ? 'bg-gray-50' : 'bg-emerald-50 border border-emerald-100'}`}>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Guest {index + 1} — Name</label>
        <input
          type="text"
          value={guest.name}
          onChange={(e) => onGuestChange(index, 'name', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          placeholder="Full name"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Email</label>
        <input
          type="email"
          value={guest.email}
          onChange={(e) => onGuestChange(index, 'email', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Phone</label>
        <input
          type="tel"
          value={guest.phone}
          onChange={(e) => onGuestChange(index, 'phone', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          placeholder="+1 000 000 0000"
        />
      </div>
    </div>
  )
}

const EMPTY_GUEST: GuestInfo = { name: '', email: '', phone: '' }

export default function GuestPassForm({ data, onChange }: GuestPassFormProps) {
  // Ensure always 8 guest slots
  const guestSlots: GuestInfo[] = Array.from({ length: 8 }, (_, i) => data.guests[i] ?? { ...EMPTY_GUEST })

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    onChange({ ...data, [key]: value })
  }

  const handleGuestChange = (index: number, field: keyof GuestInfo, value: string) => {
    const updated = [...guestSlots]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ...data, guests: updated.filter((g) => g.name || g.email || g.phone) })
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 space-y-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
        Step 2 — Review &amp; Edit Guest Pass
      </h2>

      {/* Property & Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Property</label>
          <input
            type="text"
            value={data.propertyName}
            onChange={(e) => updateField('propertyName', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Member (Owner)</label>
          <input
            type="text"
            value={data.ownerName}
            onChange={(e) => updateField('ownerName', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Check-in</label>
          <input
            type="text"
            value={data.checkIn}
            onChange={(e) => updateField('checkIn', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Check-out</label>
          <input
            type="text"
            value={data.checkOut}
            onChange={(e) => updateField('checkOut', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nights</label>
          <input
            type="number"
            value={data.nights}
            onChange={(e) => updateField('nights', Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Reservation #</label>
          <input
            type="text"
            value={data.reservationNumber}
            onChange={(e) => updateField('reservationNumber', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Guest Information (14+ years)
        </h3>
        <div className="space-y-2">
          {guestSlots.map((guest, i) => (
            <GuestRow key={i} index={i} guest={guest} onGuestChange={handleGuestChange} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Highlighted rows have pre-filled data from the check-in form. Empty rows can be filled manually.
        </p>
      </div>
    </div>
  )
}
