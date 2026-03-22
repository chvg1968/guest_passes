'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'

interface SignaturePadProps {
  onSigned: (dataUrl: string) => void
  onCleared: () => void
}

export default function SignaturePad({ onSigned, onCleared }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isSigned, setIsSigned] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: '#0a2a18',
      minWidth: 1,
      maxWidth: 2.5,
    })

    padRef.current = pad

    const resizeObserver = new ResizeObserver(() => {
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      pad.clear()
      setIsSigned(false)
      onCleared()
    })

    resizeObserver.observe(canvas.parentElement!)

    pad.addEventListener('endStroke', () => {
      if (!pad.isEmpty()) {
        setIsSigned(true)
        onSigned(pad.toDataURL('image/png'))
      }
    })

    return () => {
      resizeObserver.disconnect()
      pad.off()
    }
  }, [onSigned, onCleared])

  const handleClear = () => {
    padRef.current?.clear()
    setIsSigned(false)
    onCleared()
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">
        Step 3 — Concierge Signature
      </h2>
      <p className="text-xs text-gray-400 mb-4">Sign below to authorize the Guest Pass.</p>

      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden" style={{ height: '140px' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
        {!isSigned && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 text-sm select-none">
            Sign here
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-medium ${isSigned ? 'text-emerald-600' : 'text-gray-400'}`}>
          {isSigned ? '✓ Signature captured' : 'No signature yet'}
        </span>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-red-500 underline transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
