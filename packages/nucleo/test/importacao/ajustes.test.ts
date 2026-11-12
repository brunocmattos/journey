import { describe, expect, it } from 'vitest';
import { aplicarAjustes, type Ajuste } from '../../src/importacao/ajustes';
import { doc, fila, peca } from '../apoio';

describe('aplicarAjustes', () => {
  const base = doc({ filas: [fila('90011')], pecas: [peca('m', 'menu')] });

  it('aplica ajuste de campo sem mexer na base', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'espera_maxima_s', valor: 180 }]);
    expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(180);
    expect(base.filas[0]!.espera_maxima_s).toBeUndefined();
    expect(r.conflitos).toEqual([]);
  });

  it('ajuste sem alvo é órfão e não é aplicado', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '999', campo: 'nome', valor: 'X' };
    expect(aplicarAjustes(base, [a]).orfaos).toEqual([a]);
  });

  it('ajuste igual ao que a central traz é redundante', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 15 };
    expect(aplicarAjustes(base, [a]).redundantes).toEqual([a]);
  });

  it('central mudou desde o ajuste: vira conflito, mas o ajuste continua valendo', () => {
    const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 20, valorDaCentral: 12 };
    const r = aplicarAjustes(base, [a]);
    expect(r.conflitos).toEqual([{ ajuste: a, atualDaCentral: 15 }]);
    expect(r.efetivo.filas[0]!.toque_por_membro_s).toBe(20);
  });

  it('central igual ao valor registrado no ajuste: sem conflito', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: 20, valorDaCentral: 15 }]);
    expect(r.conflitos).toEqual([]);
  });

  it('valor undefined apaga o campo', () => {
    const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'toque_por_membro_s', valor: undefined }]);
    expect('toque_por_membro_s' in r.efetivo.filas[0]!).toBe(false);
  });

  it('criar adiciona a linha, e ajustes de campo valem pra ela', () => {
    const r = aplicarAjustes(base, [
      { tipo: 'criar', aba: 'pecas', linha: { id: 'manual-1', tipo: 'fim', ativo: true } },
      { tipo: 'campo', aba: 'pecas', id: 'manual-1', campo: 'nome', valor: 'Encerra' },
    ]);
    expect(r.efetivo.pecas.map((p) => [p.id, p.nome])).toEqual([
      ['m', undefined],
      ['manual-1', 'Encerra'],
    ]);
  });

  it('criar com id que a central já tem vira conflito', () => {
    const r = aplicarAjustes(base, [{ tipo: 'criar', aba: 'pecas', linha: { id: 'm', tipo: 'fim', ativo: true } }]);
    expect(r.conflitos).toHaveLength(1);
    expect(r.efetivo.pecas).toHaveLength(1);
  });
});
