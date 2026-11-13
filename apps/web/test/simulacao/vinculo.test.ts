import { describe, expect, it } from 'vitest';
import { vinculo } from '@/simulacao/vinculo';
import type { Sessao } from '@/simulacao/sessao';

const c = { entrada: 'entrada:e', inicio: '2026-11-24T10:00', modo: 'cenario' as const, escolhas: ['saida:m-1', 'nao_atende', 'atende'] };
const s = (escolhas: string[], extra: Partial<Sessao> = {}): Sessao => ({ entrada: c.entrada, inicio: c.inicio, modo: c.modo, escolhas, ...extra });

describe('vinculo', () => {
  it('as mesmas escolhas: o cenário inteiro, dá pra comparar', () => {
    expect(vinculo(c, s([...c.escolhas]))).toBe('completo');
  });

  it('voltar uma decisão: ainda é o caminho do cenário, só que no meio', () => {
    expect(vinculo(c, s(['saida:m-1', 'nao_atende']))).toBe('parcial');
    expect(vinculo(c, s([]))).toBe('parcial');
  });

  it('outra escolha, uma a mais, outra entrada, hora ou modo: já não é o cenário', () => {
    expect(vinculo(c, s(['saida:m-1', 'atende']))).toBeNull();
    expect(vinculo(c, s([...c.escolhas, 'x']))).toBeNull();
    expect(vinculo(c, s([...c.escolhas], { entrada: 'entrada:f' }))).toBeNull();
    expect(vinculo(c, s([...c.escolhas], { inicio: '2026-11-24T10:01' }))).toBeNull();
    expect(vinculo(c, s([...c.escolhas], { modo: 'livre' }))).toBeNull();
  });
});
