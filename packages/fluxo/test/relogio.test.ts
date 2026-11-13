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
  });

  it('dentro e fora do horário, com o fim da janela de fora', () => {
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T08:00'))).toBe(true); // segunda
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T17:59'))).toBe(true);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-23T18:00'))).toBe(false);
    expect(dentroDoHorario(comercial, lerQuando('2026-11-22T10:00'))).toBe(false); // domingo
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
  });

  it('formata tempo', () => {
    expect([40, 60, 3600, 7500, 86400, 97200].map(formatarTempo)).toEqual(['40 s', '1 min', '1 h', '2 h 5 min', '1 d', '1 d 3 h']);
  });
});
