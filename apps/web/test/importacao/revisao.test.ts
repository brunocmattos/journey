import { describe, expect, it } from 'vitest';
import type { Problema } from '@journey/nucleo';
import { relatorioCsv } from '@/importacao/revisao';

const linhaDe = (csv: string) => csv.split('\n')[1]!.split(';');

describe('relatorioCsv', () => {
  it('célula que a planilha leria como fórmula vai com apóstrofo na frente', () => {
    for (const inicio of ['=', '+', '-', '@', '\t', '\r']) {
      const p: Problema = { gravidade: 'erro', aba: 'ramais', linha: 2, coluna: `${inicio}SOMA(A1)`, mensagem: 'x' };
      const coluna = linhaDe(relatorioCsv([p]))[3]!;
      expect(coluna.replace(/^"|"$/g, '').startsWith(`'${inicio}`), JSON.stringify(inicio)).toBe(true);
    }
  });

  it('o resto sai como está', () => {
    const p: Problema = { gravidade: 'aviso', aba: 'filas', linha: 3, coluna: 'membros', mensagem: 'a fila não tem membros' };
    expect(linhaDe(relatorioCsv([p])).slice(0, 4)).toEqual(['aviso', 'filas', '3', 'membros']);
  });
});
