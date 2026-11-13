'use client';

import { useEffect, useRef } from 'react';
import { duracaoCano } from '@/editor/play';
import type { Estilo } from '@/editor/estilo';

/** Largura da água dentro do cano (o desenho "cano" tem parede; "linha" e "tracejado" não). */
export const larguraAgua = (e: Estilo): number => (e.cano === 'cano' ? Math.max(2, e.espessura - 4.5) : Math.max(2.2, e.espessura / 2.6));

/** Um cano já cheio: a água parada, com o brilho correndo se o estilo pede. */
export function AguaCheia({ d, cor, estilo }: { d: string; cor: string; estilo: Estilo }) {
  const w = larguraAgua(estilo);
  return (
    <g>
      <path className="agua-trilho" d={d} strokeWidth={w} style={{ stroke: cor }} />
      {estilo.brilho && <path className="agua-brilho" d={d} strokeWidth={Math.max(1, w / 3)} />}
    </g>
  );
}

/**
 * A água correndo num cano, quadro a quadro (requestAnimationFrame), com as bolhas na frente.
 * Pausada, o tempo não conta. Sem movimento (preferência do sistema), chega na hora. No fim, avisa.
 */
export function AguaCorrendo({ d, cor, estilo, pausado, aoChegar }: { d: string; cor: string; estilo: Estilo; pausado: boolean; aoChegar: () => void }) {
  const agua = useRef<SVGPathElement>(null);
  const bolhas = useRef<(SVGCircleElement | null)[]>([]);
  const gasto = useRef(0);
  const pausa = useRef(pausado);
  pausa.current = pausado;
  const chegar = useRef(aoChegar);
  chegar.current = aoChegar;
  const w = larguraAgua(estilo);

  useEffect(() => {
    const p = agua.current;
    if (!p) return;
    const L = p.getTotalLength();
    const dur = duracaoCano(L, estilo.velocidade);
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    p.style.strokeDasharray = `${L} ${L}`;
    let ultimo = performance.now();
    let raf = 0;
    let fim = false;
    const quadro = (t: number) => {
      if (!pausa.current) gasto.current += t - ultimo;
      ultimo = t;
      const prog = semMovimento ? 1 : Math.min(1, gasto.current / dur);
      p.style.strokeDashoffset = String(L * (1 - prog));
      const cabeca = L * prog;
      bolhas.current.forEach((b, i) => {
        if (!b) return;
        const pos = cabeca - i * 9 - (i ? Math.sin(t / 120 + i) * 3 : 0);
        if (prog >= 1 || pos < 0) return b.setAttribute('opacity', '0');
        const pt = p.getPointAtLength(Math.max(0, pos));
        b.setAttribute('cx', String(pt.x));
        b.setAttribute('cy', String(pt.y + (i % 2 ? 1.5 : -1.5)));
        b.setAttribute('opacity', '1');
      });
      if (prog < 1) raf = requestAnimationFrame(quadro);
      else if (!fim) {
        fim = true;
        chegar.current();
      }
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
    // O desenho do cano pode mudar no meio (estilo): recomeça a conta do comprimento, não do tempo gasto.
  }, [d, estilo.velocidade]);

  return (
    <g>
      <path ref={agua} className="agua-trilho" d={d} strokeWidth={w} style={{ stroke: cor, strokeDashoffset: 99999 }} />
      {estilo.bolhas &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            ref={(el) => {
              bolhas.current[i] = el;
            }}
            className="bolha"
            r={Math.max(1.2, w / (4 + i))}
            opacity={0}
          />
        ))}
    </g>
  );
}
