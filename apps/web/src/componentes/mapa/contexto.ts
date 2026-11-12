'use client';

import { createContext, useContext } from 'react';
import type { Opcao } from '@journey/nucleo';
import type { Mapa } from '@/mapa/montar';
import type { EstadoVisual } from '@/simulacao/estado';

/** O que não muda enquanto o mapa é o mesmo: o mapa e as ações (estáveis, por ref no MapaFluxo). */
export interface AcoesMapa {
  mapa: Mapa;
  /** Play a partir de um nó de entrada. */
  tocar: (noId: string) => void;
  /** Escolher pela válvula: a opção que passa por este cano. */
  escolher: (o: Opcao) => void;
  /** Ir até o destino de um atalho. */
  irPara: (noId: string) => void;
}

/** O que muda a cada passo da animação. */
export interface VistaMapa {
  estado: EstadoVisual;
  /** Nós e canos em foco (holofote). null: tudo aceso. */
  foco: Set<string> | null;
  /** Duração do enchimento do cano que está correndo, em ms. */
  duracaoCano: number;
  /** A decisão está na tela (todos os passos mostrados): os chips dos canos viram botão. */
  podeEscolher: boolean;
}

export type ContextoMapa = AcoesMapa & VistaMapa;

export const ContextoAcoes = createContext<AcoesMapa | null>(null);
export const ContextoVista = createContext<VistaMapa | null>(null);

export function useAcoesMapa(): AcoesMapa {
  const c = useContext(ContextoAcoes);
  if (!c) throw new Error('useAcoesMapa fora do MapaFluxo');
  return c;
}

export function useVistaMapa(): VistaMapa {
  const c = useContext(ContextoVista);
  if (!c) throw new Error('useVistaMapa fora do MapaFluxo');
  return c;
}
