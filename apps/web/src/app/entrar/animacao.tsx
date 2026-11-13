'use client';

import { useEffect, useRef } from 'react';

/**
 * Quem manda na animação da prévia (que é só CSS): pausa quando a aba some ou a prévia sai da tela (no celular ela
 * fica embaixo do formulário, e a água não precisa correr enquanto a pessoa digita) e, quando as voltas acabam
 * (`animation-iteration-count` no CSS), deixa o quadro final parado. Não desenha nada.
 */
export function ControleDaAnimacao() {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const previa = marca.current?.parentElement;
    if (!previa) return;
    let visivel = document.visibilityState === 'visible';
    let naTela = true;
    const aplicar = () => previa.classList.toggle('pausada', !(visivel && naTela));
    const io = new IntersectionObserver(([e]) => {
      naTela = !!e?.isIntersecting;
      aplicar();
    });
    io.observe(previa);
    const mudouAba = () => {
      visivel = document.visibilityState === 'visible';
      aplicar();
    };
    // As animações têm todas a mesma duração e acabam juntas: a do primeiro cano avisa. Dali em diante, o quadro final.
    const acabou = (e: AnimationEvent) => e.animationName === 'agua-a' && previa.classList.add('terminou');
    document.addEventListener('visibilitychange', mudouAba);
    previa.addEventListener('animationend', acabou);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', mudouAba);
      previa.removeEventListener('animationend', acabou);
    };
  }, []);
  return <span ref={marca} hidden />;
}
