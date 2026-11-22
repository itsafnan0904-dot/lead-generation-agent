import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { MuiProvider } from '@/lib/mui-provider';

// Self-hosted by Next at build time (no request to Google from the browser, so the CSP stays strict)
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'AI Sales Agent',
  description: 'Finds prospects, writes outreach and replies, and hands each lead to you when it is ready to talk money',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <MuiProvider>
          <AuthProvider>{children}</AuthProvider>
        </MuiProvider>
      </body>
    </html>
  );
}
