import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'], variable: '--fonte-display' });
const corpo = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--fonte-corpo' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--fonte-mono' });

export const metadata: Metadata = {
  title: 'Journey',
  description: 'O fluxo de atendimento como um encanamento: simule, entenda e encontre problemas.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
