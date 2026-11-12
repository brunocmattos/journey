import { describe, expect, it } from 'vitest';
import { diferencas, juntar } from '../../src/importacao/juntar';
import { doc, fila, ramal } from '../apoio';

describe('juntar', () => {
  const anterior = doc({ filas: [fila('1', { nome: 'A' }), fila('2', { nome: 'B' })], ramais: [ramal('9')] });
  const novo = doc({ filas: [fila('2', { nome: 'B2' }), fila('3', { nome: 'C' })] });

  it('import completo substitui tudo, inclusive abas que não vieram', () => {
    const b = juntar(anterior, novo, { presentes: ['filas'], parcial: false });
    expect(b.filas.map((f) => f.id)).toEqual(['2', '3']);
    expect(b.ramais).toEqual([]);
  });

  it('import parcial só mexe nas abas presentes e junta pelo id', () => {
    const b = juntar(anterior, novo, { presentes: ['filas'], parcial: true });
    expect(b.filas.map((f) => [f.id, f.nome])).toEqual([
      ['1', 'A'],
      ['2', 'B2'],
      ['3', 'C'],
    ]);
    expect(b.ramais.map((r) => r.id)).toEqual(['9']);
  });

  it('não altera os documentos recebidos', () => {
    juntar(anterior, novo, { presentes: ['filas'], parcial: true });
    expect(anterior.filas[1]!.nome).toBe('B');
  });
});

describe('diferencas', () => {
  it('lista novos, removidos e campos alterados', () => {
    const anterior = doc({ filas: [fila('1', { nome: 'A' }), fila('2', { nome: 'B' })], ramais: [ramal('9')] });
    const depois = doc({ filas: [fila('2', { nome: 'B2' }), fila('3', { nome: 'C' })] });
    expect(diferencas(anterior, depois)).toEqual({
      novos: ['filas/3'],
      removidos: ['ramais/9', 'filas/1'],
      alterados: [{ chave: 'filas/2', campos: ['nome'] }],
    });
  });
  it('sem base anterior, tudo é novo', () => {
    expect(diferencas(null, doc({ filas: [fila('2'), fila('3')] })).novos).toEqual(['filas/2', 'filas/3']);
  });
});
