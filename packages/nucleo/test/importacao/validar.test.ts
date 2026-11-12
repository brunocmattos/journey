import { describe, expect, it } from 'vitest';
import type { Documento } from '../../src/formato/documento';
import { indexar } from '../../src/formato/indice';
import { validar } from '../../src/importacao/validar';
import { doc, entrada, fila, janela, peca, saida } from '../apoio';

const problemas = (d: Documento) => validar(indexar(d));

describe('validar', () => {
  it('documento coerente não tem problemas', () => {
    const d = doc({
      entradas: [entrada('e', 'peca:m')],
      pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
      saidas: [saida('m', '1', 'fila:1'), saida('m', 'esgotou', 'fim:desliga')],
      filas: [fila('1')],
    });
    expect(problemas(d)).toEqual([]);
  });

  it('referência que não existe é aviso, não erro', () => {
    expect(problemas(doc({ entradas: [entrada('e', 'peca:nada')] }))).toEqual([
      expect.objectContaining({ gravidade: 'aviso', aba: 'entradas', coluna: 'destino', mensagem: expect.stringContaining('peca:nada') }),
    ]);
  });

  it('usa a linha de origem quando informada', () => {
    const p = validar(indexar(doc({ entradas: [entrada('e', 'peca:nada')] })), new Map([['entradas/e', 7]]));
    expect(p[0]?.linha).toBe(7);
  });

  it('regra de horário sem horário e regra de feriado sem calendário são erro', () => {
    const p = problemas(
      doc({
        pecas: [peca('h', 'regra_horario'), peca('f', 'regra_feriado')],
        saidas: [saida('h', 'sim', 'fim:desliga'), saida('f', 'sim', 'fim:desliga'), saida('g', 'sim', 'fim:desliga')],
      }),
    );
    expect(p.filter((x) => x.gravidade === 'erro').map((x) => x.coluna)).toEqual(['horario', 'calendario']);
  });

  it('saída repetida é erro; com condição diferente, não', () => {
    const p = problemas(
      doc({
        pecas: [peca('c', 'consulta')],
        saidas: [
          saida('c', 'ok', 'fim:desliga', { id: 'a' }),
          saida('c', 'ok', 'fim:desliga', { id: 'b' }),
          saida('c', 'ok', 'fim:desliga', { id: 'c', quando: { chave: 'tipo', valor: 'x' } }),
        ],
      }),
    );
    expect(p.filter((x) => x.gravidade === 'erro')).toEqual([expect.objectContaining({ aba: 'saidas', mensagem: expect.stringContaining('já existe na saída a') })]);
  });

  it('janela que termina antes de começar é erro', () => {
    expect(problemas(doc({ horarios: [janela('h', ['seg'], '18:00', '08:00')] }))).toEqual([expect.objectContaining({ gravidade: 'erro', aba: 'horarios', coluna: 'fim' })]);
  });

  it('peça sem saída e dados incompletos são avisos', () => {
    const p = problemas(doc({ pecas: [peca('m', 'menu')] }));
    expect(p.every((x) => x.gravidade === 'aviso')).toBe(true);
    expect(p.map((x) => x.mensagem)).toEqual([expect.stringContaining('não tem nenhuma saída'), expect.stringContaining('espera_s'), expect.stringContaining('esgotou')]);
  });

  it('calendário sem nenhum feriado é aviso', () => {
    const p = problemas(doc({ pecas: [peca('f', 'regra_feriado', { calendario: 'nacional' })], saidas: [saida('f', 'nao', 'fim:desliga')] }));
    expect(p).toEqual([expect.objectContaining({ gravidade: 'aviso', coluna: 'calendario' })]);
  });

  it('todo problema tem um código de regra estável', () => {
    const d = doc({
      entradas: [entrada('e', 'peca:nada')],
      horarios: [janela('h', ['seg'], '18:00', '08:00')],
      pecas: [peca('m', 'menu', { nome: 'Principal' }), peca('r', 'regra_horario'), peca('f', 'regra_feriado', { calendario: 'vazio' }), peca('g', 'regra_feriado'), peca('s', 'audio')],
      saidas: [saida('m', '1', 'fila:1'), { ...saida('m', '1', 'fim:desliga'), id: 'outra' }, saida('r', 'sim', 'fim:desliga'), saida('f', 'sim', 'fim:desliga'), saida('g', 'sim', 'fim:desliga')],
      filas: [fila('1', { toque_por_membro_s: undefined })],
    });
    const p = problemas(d);
    expect(p.length).toBeGreaterThan(8);
    expect(p.filter((x) => typeof x.regra !== 'string' || !/^[a-z]+(_[a-z]+)*$/.test(x.regra))).toEqual([]);
    expect(new Set(p.map((x) => x.regra))).toEqual(
      new Set(['ref_inexistente', 'janela_invertida', 'menu_sem_tempo', 'menu_sem_esgotou', 'regra_sem_horario', 'regra_sem_calendario', 'calendario_sem_feriado', 'peca_sem_saida', 'saida_repetida', 'fila_sem_toque']),
    );
  });
});
