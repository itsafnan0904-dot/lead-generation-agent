import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { MuiProvider } from '@/lib/mui-provider';

// Self-hosted by Next at build time (no request to Google from the browser, so the CSP stays strict)
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'AI Sales Agent | Enterprise Dashboard',
  description: 'AI-driven autonomous lead generation, scoring, and engagement platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <MuiProvider>
          <AuthProvider>{children}</AuthProvider>
        </MuiProvider>
      </body>
    </html>
  );
}
