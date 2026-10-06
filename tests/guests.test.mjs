import assert from 'node:assert/strict'
import test from 'node:test'
import { includeReservationHolder } from '../lib/guests.ts'

const contact = { name: 'Nathaniel Steiger', email: 'nathaniel@example.com', phone: '+15087333188' }
const guest = { name: 'Edeliz Flores', email: 'edeliz@example.com', phone: '845-555-0100' }

test('adds the booking contact before guests when absent', () => {
  assert.deepEqual(includeReservationHolder([guest], contact), [contact, guest])
})

test('does not duplicate a contact already listed with different name casing and spacing', () => {
  const listed = { name: '  NATHANIEL   STEIGER ', email: '', phone: '' }
  assert.deepEqual(includeReservationHolder([guest, listed], contact), [{
    ...listed, email: contact.email, phone: contact.phone,
  }, guest])
})

test('matches a listed contact by email and keeps the guest answer', () => {
  const listed = { name: 'Nathan Steiger', email: 'NATHANIEL@example.com', phone: '555-0101' }
  assert.deepEqual(includeReservationHolder([guest, listed], contact), [listed, guest])
})

test('keeps the order of the remaining guests', () => {
  const anotherGuest = { name: 'Maria Rivera', email: '', phone: '' }
  assert.deepEqual(includeReservationHolder([guest, contact, anotherGuest], contact), [contact, guest, anotherGuest])
})

test('keeps every guest and accepts the contact as the only named guest', () => {
  assert.deepEqual(includeReservationHolder([], contact), [contact])
  assert.deepEqual(includeReservationHolder([guest], { ...contact, name: '' }), [guest])
})
