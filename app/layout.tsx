import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Faceless Content Creator',
  description: 'Autonomous faceless-content operating system',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
