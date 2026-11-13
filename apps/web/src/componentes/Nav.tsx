'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav({ empresaId }: { empresaId: string }) {
  const atual = usePathname();
  const base = `/e/${empresaId}`;
  const itens = [
    { href: base, rotulo: 'Jornadas', ativo: atual === base || atual.startsWith(`${base}/j/`) },
    { href: `${base}/importar`, rotulo: 'Importar', ativo: atual.startsWith(`${base}/importar`) },
    { href: `${base}/catalogo`, rotulo: 'Catálogo', ativo: atual.startsWith(`${base}/catalogo`) },
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
