import { describe, expect, it } from 'vitest';
import { camposHorario } from '../src/cadastros';
import { dentroDoHorario, ehFeriado, formatarTempo, lerQuando } from '../src/relogio';

const comercial = camposHorario({
  id: 'h',
  tipo: 'horario',
  nome: 'Comercial',
  campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [{ data: '2026-12-25', todo_ano: true }, { data: '2026-11-20' }] },
})!;

describe('relógio', () => {
  it('lê data e hora de parede', () => {
    expect(new Date(lerQuando('2026-11-23T10:30')).toISOString()).toBe('2026-11-23T10:30:00.000Z');
    expect(() => lerQuando('23/11/2026')).toThrow('AAAA-MM-DDTHH:MM');
    for (const ruim of ['2026-02-30T10:00', '2026-11-23T24:00', '2026-11-23T10:60', '0050-01-01T10:00']) expect(() => lerQuando(ruim)).toThrow('AAAA-MM-DDTHH:MM');
  });

  it('dentro e fora do horário, com o fim da janela de fora', () => {
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T08:00'))).toBe(true); // segunda
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T17:59'))).toBe(true);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T18:00'))).toBe(false);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-22T10:00'))).toBe(false); // domingo
  });

  it('várias janelas no mesmo dia, e 24:00 como fim', () => {
    const h = camposHorario({ id: 'h', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['seg'], inicio: '08:00', fim: '12:00' }, { dias: ['seg'], inicio: '13:00', fim: '18:00' }, { dias: ['sab'], inicio: '00:00', fim: '24:00' }] } })!;
    expect(dentroDoHorario(h, lerQuando('2026-11-23T12:30'))).toBe(false); // almoço
    expect(dentroDoHorario(h, lerQuando('2026-11-23T13:00'))).toBe(true);
    expect(dentroDoHorario(h, lerQuando('2026-11-28T23:59'))).toBe(true); // sábado inteiro
    expect(dentroDoHorario(h, lerQuando('2026-11-29T00:00'))).toBe(false); // domingo
  });

  it('feriado fecha, inclusive o que repete todo ano', () => {
    expect(ehFeriado(comercial, lerQuando('2026-11-20T10:00'))).toBe(true);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-20T10:00'))).toBe(false); // sexta, feriado
    expect(dentroDoHorario(comercial, lerQuando('2027-12-25T10:00'))).toBe(false);
    expect(ehFeriado(comercial, lerQuando('2027-11-20T10:00'))).toBe(false);
  });

  it('cadastro que não é horário, ou com campos ruins, não vira horário', () => {
    expect(camposHorario({ id: 'x', tipo: 'fila', nome: 'Fila' })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['seg'], inicio: '8h', fim: '18:00' }] } })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['segunda'], inicio: '08:00', fim: '18:00' }] } })).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [] } })).toEqual({ janelas: [], feriados: [] });
    const janela = (inicio: string, fim: string) => camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [{ dias: ['seg'], inicio, fim }] } });
    expect(janela('22:00', '06:00')).toBeNull(); // invertida: passar da meia-noite são duas janelas
    expect(janela('08:00', '08:00')).toBeNull();
    expect(janela('24:00', '24:00')).toBeNull();
    const feriado = (feriados: unknown) => camposHorario({ id: 'x', tipo: 'horario', nome: 'H', campos: { janelas: [], feriados } });
    expect(feriado([{ data: '2026-02-30' }])).toBeNull();
    expect(feriado([{ data: '25/12' }])).toBeNull();
    expect(feriado({ data: '2026-12-25' })).toBeNull();
    expect(camposHorario(undefined)).toBeNull();
    expect(camposHorario({ id: 'x', tipo: 'horario', nome: 'H' })).toBeNull();
  });

  it('formata tempo', () => {
    expect([40, 60, 3600, 7500, 86400, 97200].map(formatarTempo)).toEqual(['40 s', '1 min', '1 h', '2 h 5 min', '1 d', '1 d 3 h']);
    expect([59.5, 3599, 86399, -5, NaN, Infinity].map(formatarTempo)).toEqual(['1 min', '59 min', '23 h 59 min', '0 s', '—', '—']);
  });
});
