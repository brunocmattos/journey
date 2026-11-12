import { DIAS, type Dia, type Feriado, type Horario } from '../formato/documento';

/**
 * O relógio da simulação é hora de parede, sem fuso: "2026-11-24T14:10" é 14h10 em qualquer máquina.
 * Internamente é um número de milissegundos tratado como UTC.
 */
export function lerInicio(texto: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
  if (!m) throw new Error(`início inválido: "${texto}". Use AAAA-MM-DDTHH:MM`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

export const somar = (ms: number, segundos: number): number => ms + segundos * 1000;
export const diaDaSemana = (ms: number): Dia => DIAS[new Date(ms).getUTCDay()] as Dia;
export const minutosDoDia = (ms: number): number => {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const dataIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const paraMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const paraHora = (minutos: number): string => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
export const formatarRelogio = (ms: number): string => `${diaDaSemana(ms)} ${paraHora(minutosDoDia(ms))}`;

export function dentroDoHorario(janelas: readonly Horario[], ms: number): boolean {
  const dia = diaDaSemana(ms);
  const min = minutosDoDia(ms);
  return janelas.some((j) => j.dias.includes(dia) && min >= paraMinutos(j.inicio) && min < paraMinutos(j.fim));
}

export function ehFeriado(feriados: readonly Feriado[], ms: number): boolean {
  const iso = dataIso(ms);
  return feriados.some((f) => f.data === iso || (f.todo_ano && f.data.slice(5) === iso.slice(5)));
}
