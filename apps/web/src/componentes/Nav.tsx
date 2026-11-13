'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav({ empresaId }: { empresaId: string }) {
  const atual = usePathname();
  const base = `/e/${empresaId}`;
  const itens = [
    { href: base, rotulo: 'Fluxos', ativo: atual === base || atual.startsWith(`${base}/f/`) },
    { href: `${base}/cadastros`, rotulo: 'Cadastros', ativo: atual.startsWith(`${base}/cadastros`) },
    { href: `${base}/membros`, rotulo: 'Membros', ativo: atual.startsWith(`${base}/membros`) },
  ];
  return (
    <nav className="nav" aria-label="Seções">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.ativo ? 'page' : undefined}>
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
