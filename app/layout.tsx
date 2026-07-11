export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#6D28D9',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'AI Workforce – An AI Sales Team That Books Meetings',
  description: 'Deploy an AI sales team that finds prospects, writes outreach, sends real email, and books real meetings — connected to your Gmail and CRM in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#08081C] text-[#EDEAF8] antialiased">
        {children}
      </body>
    </html>
  )
}
