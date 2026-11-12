'use client';

import { createContext, useContext } from 'react';
import type { Opcao } from '@journey/nucleo';
import type { Mapa } from '@/mapa/montar';
import type { EstadoVisual } from '@/simulacao/estado';

export interface ContextoMapa {
  mapa: Mapa;
  estado: EstadoVisual;
  /** Nós e canos em foco (holofote). null: tudo aceso. */
  foco: Set<string> | null;
  /** Duração do enchimento do cano que está correndo, em ms. */
  duracaoCano: number;
  /** Play a partir de um nó de entrada. */
  tocar: (noId: string) => void;
  /** Escolher pela válvula: a opção que passa por este cano. */
  escolher: (o: Opcao) => void;
  /** Ir até o destino de um atalho. */
  irPara: (noId: string) => void;
}

export const Contexto = createContext<ContextoMapa | null>(null);

export function useMapa(): ContextoMapa {
  const c = useContext(Contexto);
  if (!c) throw new Error('useMapa fora do MapaFluxo');
  return c;
}
