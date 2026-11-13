import { describe, expect, it } from 'vitest';
import { buscar, comNome, tipoSugerido, usosNoDocumento } from '@/editor/cadastros';
import { documentoVazio } from '@journey/fluxo';

const TIPOS = ['pessoa', 'fila', 'equipe', 'sistema', 'horario'].map((chave) => ({ chave, nome: chave }));
const K = [
  { id: '1', tipo: 'fila', nome: 'Fila Cobrança' },
  { id: '2', tipo: 'pessoa', nome: 'Ana' },
  { id: '3', tipo: 'equipe', nome: 'Cobrança jurídica' },
];

describe('editor/cadastros', () => {
  it('sugere o tipo pelo nome e pela peça', () => {
    expect(tipoSugerido('Fila Cobrança', 'atendimento', TIPOS)).toBe('fila');
    expect(tipoSugerido('Time de vendas', 'atendimento', TIPOS)).toBe('equipe');
    expect(tipoSugerido('Horário do SAC', 'decisao', TIPOS)).toBe('horario');
    expect(tipoSugerido('ERP', 'sistema', TIPOS)).toBe('sistema');
    expect(tipoSugerido('Comercial', 'decisao', TIPOS)).toBe('horario');
    expect(tipoSugerido('Maria', 'atendimento', TIPOS)).toBe('pessoa');
    expect(tipoSugerido('Maria', 'atendimento', [{ chave: 'loja', nome: 'Loja' }])).toBe('loja');
    // Palavra inteira: "Filadelfo" e "Timeout" não são fila nem equipe.
    expect(tipoSugerido('Filadelfo Souza', 'atendimento', TIPOS)).toBe('pessoa');
    expect(tipoSugerido('Timeout do gateway', 'sistema', TIPOS)).toBe('sistema');
  });

  it('busca: começa com antes de contém; nome igual sem caixa nem espaços', () => {
    expect(buscar(K, 'cob').map((k) => k.id)).toEqual(['3', '1']);
    expect(buscar(K, 'cobranca').map((k) => k.id)).toEqual(['3', '1']);
    expect(buscar(K, '').map((k) => k.id)).toEqual(['1', '2', '3']);
    expect(comNome(K, '  fila cobrança ')?.id).toBe('1');
    expect(comNome(K, 'Fila')).toBeUndefined();
  });

  it('conta os usos no documento', () => {
    const d = { ...documentoVazio(), pecas: [{ id: 'a', tipo: 'atendimento' as const, nome: 'a', x: 0, y: 0, responsavel: '1' }, { id: 'b', tipo: 'etapa' as const, nome: 'b', x: 0, y: 0, responsavel: '1' }] };
    expect(usosNoDocumento(d)).toEqual(new Map([['1', 2]]));
  });
});
