'use client';

import type { Indice } from '@journey/nucleo/formato';
import { agendaSemanal, destinoFinal, DIAS_AGENDA } from '@journey/nucleo/diagnostico';
import { nomeLegivel } from '@/simulacao/descrever';

const CORES = ['var(--agenda-1)', 'var(--agenda-2)', 'var(--agenda-3)', 'var(--agenda-4)', 'var(--agenda-5)', 'var(--agenda-6)'];
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "Quem atende quando": uma barra por dia, cor pelo destino depois das regras (spec, 12.4). */
export function Agenda({ idx, ponto }: { idx: Indice; ponto: string }) {
  const dias = agendaSemanal(idx, ponto);
  const destinos = [...new Set(dias.flat().map((s) => s.destino))];
  const cor = (d: string) => CORES[destinos.indexOf(d) % CORES.length]!;
  const nome = (d: string) => nomeLegivel(idx, destinoFinal(idx, d));
  return (
    <div className="agenda">
      <h3>Quem atende quando · {nomeLegivel(idx, ponto)}</h3>
      {dias.map((segs, i) => (
        <div className="agenda-linha" key={DIAS_AGENDA[i]}>
          <span>{DIAS_AGENDA[i]}</span>
          <div className="agenda-barra">
            {segs.map((s) => (
              <span
                key={s.inicio}
                className="agenda-seg"
                title={`${hora(s.inicio)}–${hora(s.fim)}: ${nome(s.destino)}`}
                style={{ left: `${(s.inicio / 1440) * 100}%`, width: `${((s.fim - s.inicio) / 1440) * 100}%`, background: cor(s.destino) }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="agenda-eixo">
        <span />
        <div>
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </div>
      <div className="agenda-legenda">
        {destinos.map((d) => (
          <span key={d}>
            <i style={{ background: cor(d) }} />
            {nome(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
