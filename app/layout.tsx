import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Guest Passes — Bahia Beach',
  description: 'Resort Guest Pass management for Bahia Beach properties',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-stone-100 to-emerald-50 antialiased">
        {children}
      </body>
    </html>
  )
}
