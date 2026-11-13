import type { Metadata } from 'next';
import { Suspense } from 'react';
import { dataCurta } from '@/compartilhar/opcoes';
import { Marca } from '@/componentes/Marca';
import { Jornada } from '@/componentes/jornada/Jornada';
import { abrirLink, type LinkAberto } from '@/lib/link';

type Props = { params: Promise<{ token: string }> };

const INDISPONIVEL = { title: 'Link indisponível · Journey' };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Se o link não abre por falha, o título não fica vazio: a página estoura o mesmo erro e cai no error.tsx.
  const l = await abrirLink((await params).token).catch(() => null);
  if (l?.estado !== 'ok') return INDISPONIVEL;
  return { title: `${l.retrato.cenario?.nome ?? l.retrato.jornada.nome} · Journey` };
}

const AVISOS: Record<Exclude<LinkAberto['estado'], 'ok'>, { titulo: string; texto: (quando?: string) => string }> = {
  revogado: { titulo: 'Este link foi revogado', texto: (q) => `Quem compartilhou tirou o acesso em ${dataCurta(q!)}. Pede um link novo pra quem te mandou.` },
  vencido: { titulo: 'Este link venceu', texto: (q) => `Ele valia até ${dataCurta(q!)}. Pede um link novo pra quem te mandou.` },
  inexistente: { titulo: 'Este link não existe', texto: () => 'Confere se o endereço chegou inteiro. Se chegou, pede um link novo pra quem te mandou.' },
};

/** Revogado, vencido ou que não existe (spec, 15): uma página que explica, sem nada da jornada. */
function Indisponivel({ l }: { l: Exclude<LinkAberto, { estado: 'ok' }> }) {
  const a = AVISOS[l.estado];
  return (
    <main className="entrar">
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>{a.titulo}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          {a.texto('quando' in l ? l.quando : undefined)}
        </p>
      </div>
    </main>
  );
}

/**
 * O link público (spec, 14): um retrato só de leitura montado no servidor. Quem abre não tem conta e o navegador
 * dele não fala com o banco; os nomes já saíram em `abrirLink`.
 */
export default async function PaginaLink({ params }: Props) {
  const l = await abrirLink((await params).token);
  if (l.estado !== 'ok') return <Indisponivel l={l} />;
  const r = l.retrato;
  return (
    <div className="casca cheia">
      <header className="topo">
        <Marca href={null} />
        {/* O nome da jornada é o título da página, no tamanho das migalhas. */}
        <div className="migalhas">
          <h1>{r.jornada.nome}</h1>
          <span className="barra" aria-hidden="true">
            /
          </span>
          versão {r.versao}
          {r.maisRecente && ', a mais recente'}
        </div>
        {/* A validade vai junto dos selos: no celular não ocupa uma linha sozinha. */}
        <span className="selos-link">
          <span className="selo info">só leitura</span>
          {r.esconderNomes && <span className="selo info">nomes escondidos</span>}
          {r.expiraEm && <span className="validade">vale até {dataCurta(r.expiraEm)}</span>}
        </span>
      </header>
      <Suspense>
        <Jornada
          versao={r.versao}
          documento={r.documento}
          diagnostico={r.diagnostico}
          cenarios={r.cenario ? [r.cenario] : []}
          intencionais={r.intencionais}
          membro={null}
          {...(r.cenario && { cenarioInicial: r.cenario.id })}
        />
      </Suspense>
    </div>
  );
}
