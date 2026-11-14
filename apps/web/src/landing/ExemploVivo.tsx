'use client';

import { useEffect, useState } from 'react';
import { Visualizador } from '@/componentes/editor/Visualizador';
import { agora } from '@/editor/play';
import type { ChaveAba } from './abas';
import { EXEMPLOS, quandoDoExemplo } from './exemplos';

/**
 * O visualizador de verdade com um exemplo: o que a seção dos exemplos carrega quando chega perto da tela (com o
 * editor e o @journey/fluxo). Trocar de aba monta outro (a `key`): play zerado e enquadramento novo.
 */
export default function ExemploVivo({ chave, aoMontar }: { chave: ChaveAba; aoMontar?: () => void }) {
  // Às 10h de um dia dentro do horário dos modelos, a mesma hora pra todas as abas (só no navegador: este componente não passa pelo servidor).
  const [quando] = useState(() => quandoDoExemplo(agora()));
  // Avisa a seção que chegou (o painel deixa de receber o foco ele mesmo).
  useEffect(() => aoMontar?.(), [aoMontar]);
  return <Visualizador key={chave} retrato={EXEMPLOS[chave]} embutido quando={quando} />;
}
