import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dataCurta } from '@/compartilhar/opcoes';
import { Marca } from '@/componentes/Marca';
import { Visualizador } from '@/componentes/editor/Visualizador';
import { abrirLink, type LinkAberto } from '@/lib/link';

type Props = { params: Promise<{ token: string }> };

const INDISPONIVEL = { title: 'Link indisponível · Journey' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Se o link não abre por falha, o título não fica vazio: a página estoura o mesmo erro e cai no error.tsx.
  const l = await abrirLink((await params).token).catch(() => null);
  if (l?.estado !== 'ok') return INDISPONIVEL;
  return { title: `${l.retrato.cenario?.nome ?? l.retrato.fluxo.nome} · Journey` };
}

const AVISOS: Record<'revogado' | 'vencido', { titulo: string; texto: (quando: string) => string }> = {
  revogado: { titulo: 'Este link foi revogado', texto: (q) => `Quem compartilhou tirou o acesso em ${dataCurta(q)}. Pede um link novo pra quem te mandou.` },
  vencido: { titulo: 'Este link venceu', texto: (q) => `Ele valia até ${dataCurta(q)}. Pede um link novo pra quem te mandou.` },
};

/** Revogado ou vencido: uma página que explica, com a data, sem nada do fluxo. */
function Indisponivel({ l }: { l: Extract<LinkAberto, { estado: 'revogado' | 'vencido' }> }) {
  const a = AVISOS[l.estado];
  return (
    <main className="entrar">
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>{a.titulo}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>{a.texto(l.quando)}</p>
      </div>
    </main>
  );
}

/**
 * O link público (spec, 14): um retrato só de leitura montado no servidor. Quem abre não tem conta e o navegador
 * dele não fala com o banco; os nomes já saíram em `abrirLink`. O título e a página leem o link uma vez (cache do React).
 */
export default async function PaginaLink({ params }: Props) {
  const l = await abrirLink((await params).token);
  if (l.estado === 'inexistente') notFound();
  if (l.estado !== 'ok') return <Indisponivel l={l} />;
  return <Visualizador retrato={l.retrato} />;
}
