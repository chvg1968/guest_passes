import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// In production (Netlify), PDFs are served from Netlify Blobs.
// In local dev, they are served from /tmp.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const { getStore } = await import('@netlify/blobs')
    const store = getStore('pdf-temp')
    const blob = await store.get(token, { type: 'arrayBuffer' })
    if (!blob) return new NextResponse('Not found', { status: 404 })

    // Delete after serving
    await store.delete(token).catch(() => null)

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    })
  }

  // Local dev: serve from /tmp
  const filePath = path.join('/tmp', `${token}.pdf`)
  if (!fs.existsSync(filePath)) return new NextResponse('Not found', { status: 404 })
  const buffer = fs.readFileSync(filePath)
  try { fs.unlinkSync(filePath) } catch { /* ignore */ }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
