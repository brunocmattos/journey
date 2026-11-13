'use client';

import '@xyflow/react/dist/style.css';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Background, BackgroundVariant, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react';
import type { Mapa } from '@/mapa/montar';
import { Cano, type CanoFluxo } from './Cano';
import { ContextoAcoes, ContextoVista, type AcoesMapa, type ContextoMapa, type VistaMapa } from './contexto';
import { NoFaixa, NoPonto, type NoFaixaFluxo, type NoFluxo } from './NoPonto';

const tiposNo = { ponto: NoPonto, faixa: NoFaixa };
const tiposCano = { cano: Cano };

/**
 * Nós e canos do React Flow a partir do mapa. Posição do React Flow é o canto de cima à esquerda.
 * Só dependem do mapa: o que muda a cada passo (água, holofote) vem pelo contexto, pra o React Flow não recriar
 * nem medir de novo os nós. `measured` vem do layout, que já sabe o tamanho de cada um.
 */
function paraFluxo(mapa: Mapa): { nos: Node[]; canos: Edge[] } {
  const quebrados = new Set(mapa.canos.filter((c) => c.para === null).map((c) => c.de));
  const faixas: NoFaixaFluxo[] = mapa.faixas.map((f, i) => ({
    id: `faixa:${i}`,
    type: 'faixa',
    position: { x: f.x1, y: f.y1 },
    width: f.x2 - f.x1,
    height: f.y2 - f.y1,
    measured: { width: f.x2 - f.x1, height: f.y2 - f.y1 },
    data: { titulo: f.titulo, ...(f.subtitulo && { subtitulo: f.subtitulo }) },
    draggable: false,
    selectable: false,
    focusable: false,
    zIndex: -1,
  }));
  const nos: NoFluxo[] = mapa.nos.map((n) => ({
    id: n.id,
    type: 'ponto',
    position: { x: n.x - n.w / 2, y: n.y - n.h / 2 },
    width: n.w,
    height: n.h,
    measured: { width: n.w, height: n.h },
    data: { no: n, semSaida: quebrados.has(n.id) },
    draggable: false,
    selectable: false,
  }));
  const canos: CanoFluxo[] = mapa.canos
    .filter((c) => c.para !== null)
    .map((c) => ({ id: c.id, source: c.de, target: c.para!, type: 'cano', data: { cano: c }, selectable: false, focusable: false }));
  return { nos: [...faixas, ...nos], canos };
}

type Pedido = { tipo: 'tudo' | 'nos'; ids?: string[]; n: number };

/** Segue a água com a câmera e responde aos pedidos de enquadrar. */
function Camera({ mapa, alvo, seguir, semMovimento, pedido }: { mapa: Mapa; alvo: string | null; seguir: boolean; semMovimento: boolean; pedido: Pedido }) {
  const rf = useReactFlow();
  const primeiro = useRef(true);
  useEffect(() => {
    if (!seguir || !alvo) return;
    const n = mapa.nos.find((x) => x.id === alvo);
    if (n) void rf.setCenter(n.x, n.y, { zoom: Math.max(rf.getZoom(), 0.85), duration: semMovimento ? 0 : 600 });
  }, [alvo, seguir, semMovimento, mapa, rf]);
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    const duration = semMovimento ? 0 : 600;
    if (pedido.tipo === 'tudo') void rf.fitView({ padding: 0.1, duration });
    // Lista vazia enquadraria o (0,0): sem nó pra mostrar, a câmera fica onde está.
    else if (pedido.ids?.length) void rf.fitView({ nodes: pedido.ids.map((id) => ({ id })), padding: 0.4, maxZoom: 1.1, duration });
  }, [pedido, semMovimento, rf]);
  return null;
}

export interface PropsMapa extends ContextoMapa {
  seguir: boolean;
  semMovimento: boolean;
  /** Enquadrar o mapa todo ou alguns nós; `n` muda pra repetir o mesmo pedido. */
  enquadrar: Pedido;
  children?: React.ReactNode;
}

export function MapaFluxo({ seguir, semMovimento, enquadrar, children, mapa, estado, foco, duracaoCano, podeEscolher, tocar, escolher, irPara }: PropsMapa) {
  const { nos, canos } = useMemo(() => paraFluxo(mapa), [mapa]);

  // As ações mudam a cada render de quem usa o mapa; o contexto entrega funções estáveis que chamam a mais recente.
  const ultimas = useRef({ tocar, escolher, irPara });
  useLayoutEffect(() => {
    ultimas.current = { tocar, escolher, irPara };
  });
  const acoes = useMemo<AcoesMapa>(
    () => ({
      mapa,
      tocar: (id) => ultimas.current.tocar(id),
      escolher: (o) => ultimas.current.escolher(o),
      irPara: (id) => ultimas.current.irPara(id),
    }),
    [mapa],
  );
  const vista = useMemo<VistaMapa>(() => ({ estado, foco, duracaoCano, podeEscolher }), [estado, foco, duracaoCano, podeEscolher]);

  return (
    <ContextoAcoes.Provider value={acoes}>
      <ContextoVista.Provider value={vista}>
        <div className={foco ? 'holofote' : undefined} style={{ position: 'absolute', inset: 0, ['--lit' as string]: `var(--w-${estado.canal})` }} data-testid="mapa">
          <ReactFlow
            nodes={nos}
            edges={canos}
            nodeTypes={tiposNo}
            edgeTypes={tiposCano}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.05}
            maxZoom={2}
            onlyRenderVisibleElements
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--dot)" />
            <Camera mapa={mapa} alvo={estado.atual} seguir={seguir} semMovimento={semMovimento} pedido={enquadrar} />
            {children}
          </ReactFlow>
        </div>
      </ContextoVista.Provider>
    </ContextoAcoes.Provider>
  );
}
