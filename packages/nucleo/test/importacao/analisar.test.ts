import { describe, expect, it } from 'vitest';
import type { NomeAba } from '../../src/formato/documento';
import { analisar } from '../../src/importacao/analisar';
import type { Tabelas } from '../../src/importacao/ler-arquivos';

/** Linhas brutas de uma aba, começando na linha 2 (a 1 é o cabeçalho). */
const tab = (aba: NomeAba, ...linhas: Record<string, string>[]): Tabelas => ({ [aba]: linhas.map((valores, i) => ({ linha: i + 2, valores })) });

describe('analisar', () => {
  it('converte os valores, aplica padrões e guarda a linha de origem', () => {
    const a = analisar(tab('saidas', { id: 's1', de: 'peca:menu', opcao: '1', para: 'fila:100', quando: 'tipo=aluguel' }));
    expect(a.problemas).toEqual([]);
    expect(a.documento.saidas).toEqual([{ id: 's1', de: 'peca:menu', opcao: '1', quando: { chave: 'tipo', valor: 'aluguel' }, para: 'fila:100', ativo: true }]);
    expect(a.presentes).toEqual(['saidas']);
    expect(a.linhas.get('saidas/s1')).toBe(2);
  });

  it('acusa campo obrigatório vazio com linha e coluna', () => {
    const a = analisar(tab('filas', { id: '100', estrategia: '' }));
    expect(a.problemas).toEqual([{ gravidade: 'erro', aba: 'filas', linha: 2, coluna: 'estrategia', mensagem: 'campo obrigatório vazio' }]);
  });

  it('acusa coluna obrigatória ausente uma vez só', () => {
    const a = analisar(tab('filas', { id: '1' }, { id: '2' }));
    expect(a.problemas.filter((p) => p.coluna === 'estrategia')).toEqual([{ gravidade: 'erro', aba: 'filas', coluna: 'estrategia', mensagem: 'falta a coluna obrigatória "estrategia"' }]);
  });

  it('avisa coluna desconhecida', () => {
    const a = analisar(tab('filas', { id: '1', estrategia: 'ringall', cor: 'azul' }));
    expect(a.problemas).toEqual([expect.objectContaining({ gravidade: 'aviso', coluna: 'cor' })]);
  });

  it('acusa id repetido apontando a primeira linha', () => {
    const a = analisar(tab('filas', { id: '1', estrategia: 'ringall' }, { id: '1', estrategia: 'linear' }));
    expect(a.problemas[0]?.mensagem).toBe('o id "1" se repete (já usado na linha 2)');
    expect(a.documento.filas).toHaveLength(1);
  });

  it('acusa id com caractere inválido', () => {
    const a = analisar(tab('filas', { id: 'fila 1', estrategia: 'ringall' }));
    expect(a.problemas[0]).toMatchObject({ gravidade: 'erro', coluna: 'id' });
  });

  it('acusa valor inválido e continua lendo o resto', () => {
    const a = analisar(tab('ramais', { id: '1', toque_s: 'vinte' }, { id: '2', toque_s: '20' }));
    expect(a.problemas).toEqual([expect.objectContaining({ linha: 2, coluna: 'toque_s' })]);
    expect(a.documento.ramais.map((r) => r.id)).toEqual(['1', '2']);
  });
});
