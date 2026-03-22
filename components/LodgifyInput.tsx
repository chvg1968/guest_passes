'use client'

interface LodgifyInputProps {
  value: string
  onChange: (val: string) => void
  onProcess: () => void
  loading: boolean
}

export default function LodgifyInput({ value, onChange, onProcess, loading }: LodgifyInputProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
        Step 1 — Paste Lodgify Reservation Text
      </h2>
      <textarea
        className="w-full h-56 p-4 text-sm font-mono border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 text-gray-800 placeholder-gray-400"
        placeholder="Copy the full reservation text from Lodgify and paste it here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      />
      <div className="mt-4 flex justify-end">
        <button
          onClick={onProcess}
          disabled={loading || value.trim().length < 50}
          className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Procesar
            </>
          )}
        </button>
      </div>
    </div>
  )
}
