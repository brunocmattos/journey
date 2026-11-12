'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { duracaoDoPasso } from '@/simulacao/estado';
import type { Passo } from '@/simulacao/passos';

/** "Reduzir movimento" do sistema. */
export function useSemMovimento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia('(prefers-reduced-motion: reduce)');
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/**
 * Mostra os passos um a um. `k` é quantos já estão na tela; cada passo fica o tempo dele antes do próximo.
 * Quando os passos mudam por uma escolha, o começo é o mesmo (o motor é previsível) e a animação segue de onde estava.
 */
export function usePlayer(passos: readonly Passo[], opcoes: { velocidade: number; pausado: boolean; semMovimento: boolean }) {
  const [k, setK] = useState(0);
  const { velocidade, pausado, semMovimento } = opcoes;
  useEffect(() => {
    if (pausado || k >= passos.length) return;
    const ms = k === 0 ? 0 : duracaoDoPasso(passos[k - 1]!, velocidade, semMovimento);
    const t = setTimeout(() => setK(k + 1), ms);
    return () => clearTimeout(t);
  }, [k, passos, pausado, velocidade, semMovimento]);
  return { k: Math.min(k, passos.length), irPara: setK };
}
