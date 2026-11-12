import { describe, expect, it } from 'vitest';
import type { Feriado } from '../../src/formato/documento';
import { dentroDoHorario, ehFeriado, formatarRelogio, lerInicio, somar } from '../../src/motor/relogio';
import { janela } from '../apoio';

describe('relógio', () => {
  it('lê hora de parede e soma segundos', () => {
    const ms = lerInicio('2026-11-24T16:57');
    expect(formatarRelogio(ms)).toBe('ter 16:57');
    expect(formatarRelogio(somar(ms, 180))).toBe('ter 17:00');
  });

  it('recusa início mal escrito', () => {
    expect(() => lerInicio('24/11/2026')).toThrow('AAAA-MM-DDTHH:MM');
  });

  it('dentro do horário: o início conta, o fim não', () => {
    const j = [janela('h', ['ter'], '08:30', '16:55')];
    expect(dentroDoHorario(j, lerInicio('2026-11-24T08:30'))).toBe(true);
    expect(dentroDoHorario(j, lerInicio('2026-11-24T16:55'))).toBe(false);
    expect(dentroDoHorario(j, lerInicio('2026-11-25T10:00'))).toBe(false);
  });

  it('feriado pela data exata ou todo ano', () => {
    const f: Feriado[] = [
      { id: 'a', calendario: 'c', data: '2025-12-25', todo_ano: true },
      { id: 'b', calendario: 'c', data: '2026-11-20', todo_ano: false },
    ];
    expect(ehFeriado(f, lerInicio('2026-12-25T10:00'))).toBe(true);
    expect(ehFeriado(f, lerInicio('2026-11-20T10:00'))).toBe(true);
    expect(ehFeriado(f, lerInicio('2027-11-20T10:00'))).toBe(false);
  });
});
