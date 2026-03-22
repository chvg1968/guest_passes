'use client'

import { useState, useCallback } from 'react'
import LodgifyInput from '@/components/LodgifyInput'
import GuestPassForm from '@/components/GuestPassForm'
import SignaturePad from '@/components/SignaturePad'
import type { ParsedReservation } from '@/lib/claude'

interface FormData extends ParsedReservation {
  ownerName: string
}

export default function HomePage() {
  const [rawText, setRawText] = useState('')
  const [formData, setFormData] = useState<FormData | null>(null)
  const [signature, setSignature] = useState('')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [warningMsg, setWarningMsg] = useState('')

  const handleProcess = async () => {
    setParsing(true)
    setErrorMsg('')
    setWarningMsg('')
    setFormData(null)
    setSignature('')
    setDone(false)

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Unknown error during processing.')
        return
      }
      setFormData(data)
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  const handleSigned = useCallback((dataUrl: string) => setSignature(dataUrl), [])
  const handleCleared = useCallback(() => setSignature(''), [])

  const handleSubmit = async () => {
    if (!formData || !signature) return
    setSubmitting(true)
    setErrorMsg('')
    setWarningMsg('')

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, signatureDataUrl: signature }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Submission failed.')
        return
      }
      if (data.warning) setWarningMsg(data.warning)
      setDone(true)
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setRawText('')
    setFormData(null)
    setSignature('')
    setParsing(false)
    setSubmitting(false)
    setDone(false)
    setErrorMsg('')
    setWarningMsg('')
  }

  const showForm = formData !== null && !done
  const canSubmit = showForm && !!signature && !submitting

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-900 to-emerald-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold tracking-wide">Guest Passes</h1>
            <p className="text-emerald-300 text-xs mt-0.5 tracking-wider uppercase">
              Bahia Beach Resort &amp; Golf Club
            </p>
          </div>
          {(showForm || done) && (
            <button
              onClick={handleReset}
              className="text-emerald-200 hover:text-white text-sm underline transition-colors"
            >
              ← New Pass
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Success */}
        {done && (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center border border-emerald-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Guest Pass Sent!</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              The Resort Guest Pass PDF has been emailed to the guest and a copy sent to the concierge.
              The Airtable record has been updated.
            </p>
            {warningMsg && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm text-left">
                <strong>Note:</strong> {warningMsg}
              </div>
            )}
            <button
              onClick={handleReset}
              className="mt-6 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Create Another Pass
            </button>
          </div>
        )}

        {/* Error alert */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Main flow */}
        {!done && (
          <>
            <LodgifyInput
              value={rawText}
              onChange={setRawText}
              onProcess={handleProcess}
              loading={parsing}
            />

            {showForm && (
              <>
                <GuestPassForm data={formData} onChange={setFormData} />

                <SignaturePad onSigned={handleSigned} onCleared={handleCleared} />

                {!signature && (
                  <p className="text-right text-xs text-amber-600">
                    ⚠ Concierge signature required before sending.
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-8 py-4 rounded-xl transition-colors text-base shadow-md"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Guest Pass
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
