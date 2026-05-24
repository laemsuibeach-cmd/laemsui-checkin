import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Laemsui Resort Check-in',
  description: 'Guest Registration System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Check-in',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // ป้องกัน zoom ขณะเซ็น
  userScalable: false,
  themeColor: '#0f766e',
  viewportFit: 'cover', // safe-area สำหรับ iPad notch / home indicator
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '1rem',        // scales with html font-size (17–19px on tablet)
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
            },
          }}
        />
      </body>
    </html>
  )
}
