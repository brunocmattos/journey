'use client';

import { memo } from 'react';
import { formatarTempo, textoRegra, type Conexao, type Grupo, type Nota, type Peca } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { FORMAS } from '@/editor/pecas';

/**
 * Tudo em valores simples (nada de objeto montado a cada desenho), senão o `memo` nunca segura nada. A simulação
 * marca a peça como molhada (`agua`, a cor), a atual, perguntando e em foco no holofote.
 */
export interface PropsPeca {
  peca: Peca;
  selecionada: boolean;
  /** Nome do responsável (o cadastro), se há. */
  responsavel?: string;
  canalNome?: string;
  canalCor?: string;
  /** Cor do Início: a do canal em que a água começa. */
  corInicio: string;
  agua?: string;
  atual?: boolean;
  perguntando?: boolean;
  foco?: boolean;
  /** Só leitura: sem a bolinha de ligar e sem o +. */
  soLeitura: boolean;
}

/**
 * Uma peça no quadro. Memorizada: arrastar uma peça não redesenha as outras. Dá pra chegar nela pelo Tab; o teclado
 * e o clique sem ponteiro (leitor de tela) são tratados no quadro.
 */
export const PecaNoQuadro = memo(function PecaNoQuadro({ peca: p, selecionada, responsavel, canalNome, canalCor, corInicio, agua, atual, perguntando, foco, soLeitura }: PropsPeca) {
  const f = FORMAS[p.tipo];
  const classes = ['no', `t-${p.tipo}`];
  if (selecionada) classes.push('sel');
  if (p.cor && p.tipo !== 'decisao') classes.push('com-cor');
  if (agua) classes.push('molhado');
  if (atual) classes.push('atual');
  if (perguntando) classes.push('perguntando');
  if (foco) classes.push('foco');
  const estilo: Record<string, string | number> = { left: p.x, top: p.y, width: f.w, height: f.h };
  if (p.tipo === 'inicio') estilo['--c'] = corInicio;
  if (p.cor && p.tipo !== 'decisao') estilo['--pc'] = p.cor;
  if (agua) estilo['--agua'] = agua;
  const sub = [responsavel ?? f.nome, p.tempo_s ? formatarTempo(p.tempo_s) : null].filter(Boolean).join(' · ');
  return (
    <div className={classes.join(' ')} data-peca={p.id} style={estilo} role="button" tabIndex={0} aria-label={`${f.nome}: ${p.nome}`} aria-pressed={selecionada}>
      {p.tipo !== 'decisao' && (
        <span className="etiqueta">
          {f.nome.toLowerCase()}
          {canalNome ? ` · ${canalNome.toLowerCase()}` : ''}
        </span>
      )}
      <span className="nivel" />
      <span className="tile">
        <Icone nome={p.tipo} />
      </span>
      <span className="textos">
        <span className="titulo">{p.nome}</span>
        <span className="sub">
          {canalNome && <span className="ponto-canal" style={{ ['--c' as string]: canalCor }} />}
          <span>{sub}</span>
        </span>
      </span>
      {!soLeitura && (
        <>
          <span className="ponta" data-ponta={p.id} title="Arraste pra ligar" />
          {/* Só entra no Tab com a peça selecionada (fora disso ele nem aparece). */}
          <button className="mais" type="button" data-mais={p.id} tabIndex={selecionada ? 0 : -1} aria-label={`Criar a próxima etapa ligada a ${p.nome}`}>
            <Icone nome="mais" />
          </button>
        </>
      )}
    </div>
  );
});

export const NotaNoQuadro = memo(function NotaNoQuadro({ nota: n, selecionada }: { nota: Nota; selecionada: boolean }) {
  const estilo: Record<string, string | number> = { left: n.x, top: n.y, width: n.w, height: n.h };
  if (n.cor) estilo['--pc'] = n.cor;
  return (
    <div className={`no t-nota${n.cor ? ' com-cor' : ''}${selecionada ? ' sel' : ''}`} data-nota={n.id} style={estilo} role="button" tabIndex={0} aria-label={`Nota: ${n.texto}`} aria-pressed={selecionada}>
      <span className="textos">
        <span className="titulo">{n.texto}</span>
      </span>
    </div>
  );
});

export const GrupoNoQuadro = memo(function GrupoNoQuadro({ grupo: g, selecionado }: { grupo: Grupo; selecionado: boolean }) {
  return (
    <div
      className={`grupo${selecionado ? ' sel' : ''}`}
      data-grupo={g.id}
      style={{ left: g.x, top: g.y, width: g.w, height: g.h, ...(g.cor && { ['--gc' as string]: g.cor }) }}
      // No Tab como as peças: Enter ou espaço seleciona, Enter no selecionado renomeia (tratado no quadro).
      role="button"
      tabIndex={0}
      aria-label={`Grupo: ${g.nome}`}
      aria-pressed={selecionado}
    >
      <span className="g-titulo">{g.nome}</span>
      <span className="alca" data-alca={g.id} />
    </div>
  );
});

/** O texto no meio do cano. Na pergunta do play, os das opções viram botão. */
export const RotuloCano = memo(function RotuloCano({
  conexao: c,
  x,
  y,
  selecionado,
  escolhivel,
  destacado = false,
  corAgua,
}: {
  conexao: Conexao;
  x: number;
  y: number;
  selecionado: boolean;
  escolhivel: boolean;
  /** No holofote de um achado. */
  destacado?: boolean;
  corAgua?: string;
}) {
  const t = textoRegra(c);
  if (!t) return null;
  return (
    <div
      className={`rotulo-cano${selecionado ? ' sel' : ''}${escolhivel ? ' escolhivel foco' : destacado ? ' foco' : ''}`}
      data-rotulo={c.id}
      style={{ left: x, top: y, ...(escolhivel && corAgua && { ['--agua' as string]: corAgua }) }}
      role="button"
      tabIndex={0}
      aria-label={escolhivel ? `Escolher ${t}` : `Ligação: ${t}`}
    >
      {t}
    </div>
  );
});
