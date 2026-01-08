import type { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Referent App',
  description: 'Minimal Next.js application',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}


