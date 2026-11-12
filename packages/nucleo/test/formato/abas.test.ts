import { describe, expect, it } from 'vitest';
import { ABAS } from '../../src/formato/abas';
import { NOMES_ABAS } from '../../src/formato/documento';

describe('abas', () => {
  it('tem uma definição por aba, na ordem', () => {
    expect(Object.keys(ABAS)).toEqual([...NOMES_ABAS]);
  });

  it.each(NOMES_ABAS)('%s começa com id obrigatório e não repete coluna', (aba) => {
    const colunas = ABAS[aba].colunas;
    expect(colunas[0]).toMatchObject({ nome: 'id', obrigatoria: true });
    expect(new Set(colunas.map((c) => c.nome)).size).toBe(colunas.length);
  });

  it.each(NOMES_ABAS)('%s tem exemplos só com colunas conhecidas', (aba) => {
    const nomes = new Set(ABAS[aba].colunas.map((c) => c.nome));
    expect(ABAS[aba].exemplos.length).toBeGreaterThan(0);
    for (const ex of ABAS[aba].exemplos) for (const k of Object.keys(ex)) expect(nomes.has(k), `${aba}.${k}`).toBe(true);
  });

  it('listas e referências declaram os valores aceitos', () => {
    for (const aba of NOMES_ABAS) {
      for (const c of ABAS[aba].colunas) {
        if (c.tipo === 'enum') expect(c.valores?.length, `${aba}.${c.nome}`).toBeGreaterThan(0);
        if (c.tipo === 'ref' || c.tipo === 'refs') expect(c.refs?.length, `${aba}.${c.nome}`).toBeGreaterThan(0);
      }
    }
  });
});
