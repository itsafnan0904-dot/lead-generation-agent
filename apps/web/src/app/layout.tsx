import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { MuiProvider } from '@/lib/mui-provider';

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
    <html lang="en">
      <body>
        <MuiProvider>
          <AuthProvider>{children}</AuthProvider>
        </MuiProvider>
      </body>
    </html>
  );
}
