'use client';

import { EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react';
import type { CanoMapa } from '@/mapa/montar';
import { useAcoesMapa, useVistaMapa } from './contexto';

export type CanoFluxo = Edge<{ cano: CanoMapa }, 'cano'>;

/** Distância do cotovelo depois da saída. */
const MANIFOLD = 46;

/** Sai reto, faz a curva com raio pequeno e entra reto (o desenho do protótipo). */
export function caminhoCano(sx: number, sy: number, tx: number, ty: number): string {
  if (Math.abs(sy - ty) < 1) return `M${sx},${sy} H${tx}`;
  const mx = sx + MANIFOLD;
  const dir = ty > sy ? 1 : -1;
  const r = Math.max(0, Math.min(16, Math.abs(ty - sy) / 2, mx - sx, tx - mx));
  return `M${sx},${sy} H${mx - r} Q${mx},${sy} ${mx},${sy + dir * r} V${ty - dir * r} Q${mx},${ty} ${mx + r},${ty} H${tx}`;
}

export function Cano({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<CanoFluxo>) {
  const { escolher } = useAcoesMapa();
  const { estado, duracaoCano, foco, podeEscolher } = useVistaMapa();
  const cano = data!.cano;
  const d = caminhoCano(sourceX, sourceY, targetX, targetY);
  const molhado = estado.molhados.has(id);
  const correndo = estado.correndo === id;
  const pergunta = estado.perguntando?.no === cano.de ? estado.perguntando : null;
  // Opção que esta válvula oferece por este cano (uma basta: as outras do mesmo cano vão pro mesmo lugar).
  // Cano que o motor não usa não vira botão: o clique não teria pra onde ir. Nem antes de a decisão estar na tela.
  const opcao = cano.simulavel && podeEscolher ? pergunta?.opcoes.find((o) => o.disponivel && (o.saida ? cano.saidas.includes(o.saida) : cano.opcoes.includes(o.opcao))) : undefined;
  const chipX = Math.abs(sourceY - targetY) < 1 ? (sourceX + targetX) / 2 : (sourceX + MANIFOLD + targetX) / 2;
  const mostraChip = cano.rotulo !== '' && cano.opcoes.length > 0;
  const emFoco = !foco || foco.has(id);
  return (
    <>
      <g className={`cano k-${cano.tipo}${foco?.has(id) ? ' foco' : ''}`}>
        <path d={d} className="cano-parede" />
        <path d={d} className="cano-nucleo" />
        {cano.tipo !== 'inativo' && <path d={d} className="cano-brilho" />}
        <rect x={sourceX - 1} y={sourceY - 12} width={6} height={24} rx={2} className="luva" />
        <rect x={targetX - 5} y={targetY - 12} width={6} height={24} rx={2} className="luva" />
        {molhado && (
          <>
            <path d={d} pathLength={1} className={`cano-agua${correndo ? ' correndo' : ''}`} style={{ ['--duracao' as string]: `${duracaoCano}ms` }} />
            {!correndo && <path d={d} className="cano-espuma" />}
          </>
        )}
      </g>
      {mostraChip && (
        <EdgeLabelRenderer>
          {opcao ? (
            <button
              type="button"
              className={`chip${/^[0-9*#·]+$/.test(cano.rotulo) ? '' : ' texto'} foco`}
              style={{ left: chipX, top: targetY }}
              onClick={() => escolher(opcao)}
              aria-label={`Escolher ${cano.rotulo}`}
            >
              {cano.rotulo}
            </button>
          ) : (
            <span
              className={`chip${/^[0-9*#·]+$/.test(cano.rotulo) ? '' : ' texto'}${estado.escolhidos.has(id) ? ' escolhido' : ''}${emFoco ? ' foco' : ''}`}
              style={{ left: chipX, top: targetY }}
            >
              {cano.rotulo}
            </span>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
