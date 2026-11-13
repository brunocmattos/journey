import { DIAS, type CamposHorario, type Dia } from './cadastros';

/**
 * O relógio da simulação é hora de parede, sem fuso: "2026-11-24T14:10" é 14h10 em qualquer máquina.
 * Internamente é um número de milissegundos tratado como UTC.
 */
export function lerQuando(texto: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto);
  const ms = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : NaN;
  // Date.UTC aceita 30 de fevereiro e 24h (vira o dia seguinte): só vale o que volta igual.
  if (!m || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 16) !== texto) {
    throw new Error(`data e hora inválidas: "${texto}". Use AAAA-MM-DDTHH:MM`);
  }
  return ms;
}

const diaDaSemana = (ms: number): Dia => DIAS[new Date(ms).getUTCDay()] as Dia;
const minutosDoDia = (ms: number): number => {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const paraMinutos = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function ehFeriado(h: CamposHorario, ms: number): boolean {
  const iso = new Date(ms).toISOString().slice(0, 10);
  return h.feriados.some((f) => f.data === iso || (f.todo_ano === true && f.data.slice(5) === iso.slice(5)));
}

/** Dentro de alguma janela da semana e fora dos feriados. `ms` é hora de parede, de `lerQuando` (não `Date.now()`). */
export function dentroDoHorario(h: CamposHorario, ms: number): boolean {
  if (ehFeriado(h, ms)) return false;
  const dia = diaDaSemana(ms);
  const min = minutosDoDia(ms);
  return h.janelas.some((j) => j.dias.includes(dia) && min >= paraMinutos(j.inicio) && min < paraMinutos(j.fim));
}

/** "2 h 5 min", "3 d 4 h", "40 s". */
export function formatarTempo(segundos: number): string {
  if (!Number.isFinite(segundos)) return '—';
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return h ? `${d} d ${h} h` : `${d} d`;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}
