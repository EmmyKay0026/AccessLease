import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AccessLease — Verifiable temporary permissions',
  description: 'Live on-chain permission verification and synthetic resource access on Arkiv Tiramisu.',
};
export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
