import { describe, expect, it } from 'vitest';
import { aplicarAjustes, type Ajuste } from '../../src/importacao/ajustes';
import type { NomeAba } from '../../src/formato/documento';
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

  describe('checagem contra as colunas da aba', () => {
    it('valor em texto é lido pela mesma regra do import: "180" vira 180', () => {
      const r = aplicarAjustes(base, [{ tipo: 'campo', aba: 'filas', id: '90011', campo: 'espera_maxima_s', valor: '180' }]);
      expect(r.efetivo.filas[0]!.espera_maxima_s).toBe(180);
      expect(r.invalidos).toEqual([]);
    });

    it('valor que a coluna não aceita não é aplicado e é relatado com a mensagem do leitor', () => {
      const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'espera_maxima_s', valor: 'abc' };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'espera_maxima_s', mensagem: '"abc" não é um número inteiro' }]);
      expect(r.efetivo.filas[0]!.espera_maxima_s).toBeUndefined();
    });

    it('coluna que não existe na aba não é aplicada', () => {
      const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'cor', valor: 'azul' };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'cor', mensagem: expect.stringContaining('"cor" não existe') }]);
      expect('cor' in r.efetivo.filas[0]!).toBe(false);
    });

    it('aba que não existe não é aplicada', () => {
      const a = { tipo: 'campo', aba: 'xyz' as NomeAba, id: '1', campo: 'nome', valor: 'X' } satisfies Ajuste;
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, mensagem: expect.stringContaining('"xyz" não existe') }]);
      expect(r.orfaos).toEqual([]);
    });

    it('o id não é ajustável', () => {
      const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'id', valor: '90012' };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'id', mensagem: expect.stringContaining('id') }]);
      expect(r.efetivo.filas[0]!.id).toBe('90011');
    });

    it('apagar coluna obrigatória sem padrão não é aplicado', () => {
      const a: Ajuste = { tipo: 'campo', aba: 'filas', id: '90011', campo: 'estrategia', valor: undefined };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'estrategia', mensagem: expect.stringContaining('obrigatório') }]);
      expect(r.efetivo.filas[0]!.estrategia).toBe('rrmemory');
    });

    it('apagar coluna com padrão volta ao padrão, como uma célula vazia no import', () => {
      const r = aplicarAjustes(doc({ pecas: [peca('m', 'menu', { ativo: false })] }), [{ tipo: 'campo', aba: 'pecas', id: 'm', campo: 'ativo', valor: undefined }]);
      expect(r.efetivo.pecas[0]!.ativo).toBe(true);
    });

    it('criar com valor fora da lista não é aplicado', () => {
      const a: Ajuste = { tipo: 'criar', aba: 'pecas', linha: { id: 'manual-1', tipo: 'xyz' } };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'tipo', mensagem: expect.stringContaining('"xyz" não é permitido') }]);
      expect(r.efetivo.pecas.map((p) => p.id)).toEqual(['m']);
    });

    it('criar sem coluna obrigatória não é aplicado', () => {
      const a: Ajuste = { tipo: 'criar', aba: 'saidas', linha: { id: 'manual-s', de: 'peca:m', opcao: '1' } };
      const r = aplicarAjustes(base, [a]);
      expect(r.invalidos).toEqual([{ ajuste: a, coluna: 'para', mensagem: 'campo obrigatório vazio' }]);
      expect(r.efetivo.saidas).toEqual([]);
    });

    it('criar com id inválido ou coluna desconhecida não é aplicado', () => {
      const semId: Ajuste = { tipo: 'criar', aba: 'pecas', linha: { id: 'manual 1', tipo: 'fim' } };
      const comCor: Ajuste = { tipo: 'criar', aba: 'pecas', linha: { id: 'manual-2', tipo: 'fim', cor: 'azul' } };
      const r = aplicarAjustes(base, [semId, comCor]);
      expect(r.invalidos).toEqual([
        { ajuste: semId, coluna: 'id', mensagem: expect.stringContaining('caracteres inválidos') },
        { ajuste: comCor, coluna: 'cor', mensagem: expect.stringContaining('"cor" não existe') },
      ]);
      expect(r.efetivo.pecas).toHaveLength(1);
    });

    it('criar lê os valores e preenche os padrões como o import', () => {
      const r = aplicarAjustes(base, [{ tipo: 'criar', aba: 'filas', linha: { id: 'manual-f', estrategia: 'Linear', espera_maxima_s: '60', membros: ['ramal:1'] } }]);
      expect(r.invalidos).toEqual([]);
      expect(r.efetivo.filas[1]).toEqual({ id: 'manual-f', estrategia: 'linear', espera_maxima_s: 60, membros: ['ramal:1'], membros_dinamicos: false });
    });
  });
});
