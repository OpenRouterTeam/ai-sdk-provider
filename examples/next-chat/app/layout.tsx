import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenRouter Chat Playground',
  description:
    'A minimal Next.js chat app that demonstrates streaming OpenRouter responses, model selection, and tool use.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
