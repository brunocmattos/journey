'use client';

import { useEffect, useRef } from 'react';

/**
 * Os dois botões de uma confirmação no lugar (apagar, revogar, restaurar). A escolha segura vem primeiro e recebe o
 * foco: o segundo clique de um duplo clique no botão que abriu a confirmação cai nela, e não na que confirma. E os
 * dois ignoram o clique que já é o segundo (`detail` > 1); pelo teclado o `detail` é 0 e vale.
 */
export function Confirmacao({ nao, sim, aoCancelar, aoConfirmar }: { nao: string; sim: string; aoCancelar: () => void; aoConfirmar: () => void }) {
  const seguro = useRef<HTMLButtonElement>(null);
  useEffect(() => seguro.current?.focus(), []);
  return (
    <>
      <button ref={seguro} className="botao pequeno" type="button" onClick={(e) => e.detail <= 1 && aoCancelar()}>
        {nao}
      </button>
      <button className="botao pequeno perigo" type="button" onClick={(e) => e.detail <= 1 && aoConfirmar()}>
        {sim}
      </button>
    </>
  );
}

/** Foca um elemento depois do próximo desenho (o botão que volta a aparecer, a lista que sobrou). */
export const focarDepois = (achar: () => HTMLElement | null | undefined) => requestAnimationFrame(() => achar()?.focus());
