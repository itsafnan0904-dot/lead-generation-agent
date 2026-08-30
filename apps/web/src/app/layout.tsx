import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Gmail Sales Agent',
  description: 'AI Sales Agent monorepo workspace foundation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
