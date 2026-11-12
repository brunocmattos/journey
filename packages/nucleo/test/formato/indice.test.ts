import { describe, expect, it } from 'vitest';
import { completude } from '../../src/formato/completude';
import { existe, indexar, nomeDe } from '../../src/formato/indice';
import { doc, fila, janela, peca, saida } from '../apoio';

describe('indexar', () => {
  const idx = indexar(
    doc({
      pecas: [peca('menu', 'menu', { nome: 'Menu' }), peca('fim', 'fim')],
      saidas: [saida('menu', '1', 'peca:fim'), saida('menu', 'esgotou', 'fim:desliga')],
      filas: [fila('100', { nome: 'Atendimento' })],
      horarios: [janela('h', ['seg'], '08:00', '12:00'), janela('h', ['ter'], '08:00', '12:00')],
    }),
  );

  it('agrupa as saídas por peça, na ordem do arquivo', () => {
    expect(idx.saidasDe.get('menu')!.map((s) => s.opcao)).toEqual(['1', 'esgotou']);
  });
  it('agrupa as janelas pelo grupo de horário', () => {
    expect(idx.janelas.get('h')).toHaveLength(2);
  });
  it('existe confere cada tipo e as embutidas', () => {
    expect(existe(idx, 'peca:menu')).toBe(true);
    expect(existe(idx, 'peca:nada')).toBe(false);
    expect(existe(idx, 'horario:h')).toBe(true);
    expect(existe(idx, 'fim:desliga')).toBe(true);
    expect(existe(idx, 'fim:outro')).toBe(false);
    expect(existe(idx, 'lixo')).toBe(false);
  });
  it('dá nomes legíveis', () => {
    expect(nomeDe(idx, 'peca:menu')).toBe('Menu');
    expect(nomeDe(idx, 'fila:100')).toBe('fila 100 (Atendimento)');
    expect(nomeDe(idx, 'ramal:1')).toBe('ramal 1');
    expect(nomeDe(idx, 'fim:desliga')).toBe('desligar');
    expect(nomeDe(idx, 'constructor')).toBe('constructor');
  });
});

describe('completude', () => {
  it('aponta menu sem tempo, menu sem esgotou e fila sem toque', () => {
    const idx = indexar(
      doc({
        pecas: [peca('m', 'menu'), peca('ok', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [saida('ok', 'esgotou', 'fim:desliga')],
        filas: [fila('1', { toque_por_membro_s: undefined })],
      }),
    );
    expect(completude(idx).map((p) => `${p.regra}:${p.ref}`)).toEqual(['menu_sem_tempo:peca:m', 'menu_sem_esgotou:peca:m', 'fila_sem_toque:fila:1']);
  });
});
