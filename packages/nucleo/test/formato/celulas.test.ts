import { describe, expect, it } from 'vitest';
import { ABAS, type Coluna } from '../../src/formato/abas';
import { lerCelula, paraCelula } from '../../src/formato/celulas';
import { NOMES_ABAS } from '../../src/formato/documento';

const col = (c: Partial<Coluna> & Pick<Coluna, 'tipo'>): Coluna => ({ nome: 'x', descricao: '', ...c });

describe('lerCelula', () => {
  it('vazio sem padrão devolve null; com padrão usa o padrão', () => {
    expect(lerCelula(col({ tipo: 'texto' }), '  ')).toBeNull();
    expect(lerCelula(col({ tipo: 'booleano', padrao: 'sim' }), '')).toEqual({ ok: true, valor: true });
  });
  it('inteiro', () => {
    expect(lerCelula(col({ tipo: 'inteiro' }), '20')).toEqual({ ok: true, valor: 20 });
    expect(lerCelula(col({ tipo: 'inteiro' }), '2,5')).toMatchObject({ ok: false });
  });
  it('booleano aceita sim, não, s e n', () => {
    expect(lerCelula(col({ tipo: 'booleano' }), 'Não')).toEqual({ ok: true, valor: false });
    expect(lerCelula(col({ tipo: 'booleano' }), 'S')).toEqual({ ok: true, valor: true });
    expect(lerCelula(col({ tipo: 'booleano' }), 'talvez')).toMatchObject({ ok: false });
  });
  it('lista ignora maiúsculas e mostra os valores aceitos no erro', () => {
    const c = col({ tipo: 'enum', valores: ['telefonia', 'email'] });
    expect(lerCelula(c, 'EMAIL')).toEqual({ ok: true, valor: 'email' });
    expect(lerCelula(c, 'fax')).toMatchObject({ ok: false, erro: expect.stringContaining('telefonia, email') });
  });
  it('referência confere o tipo permitido', () => {
    const c = col({ tipo: 'ref', refs: ['fila', 'ramal'] });
    expect(lerCelula(c, ' fila:90011 ')).toEqual({ ok: true, valor: 'fila:90011' });
    expect(lerCelula(c, 'peca:x')).toMatchObject({ ok: false, erro: expect.stringContaining('fila, ramal') });
    expect(lerCelula(c, '90011')).toMatchObject({ ok: false, erro: expect.stringContaining('tipo:id') });
  });
  it('várias referências separadas por espaço ou vírgula', () => {
    expect(lerCelula(col({ tipo: 'refs', refs: ['ramal'] }), 'ramal:1 ramal:2,ramal:3')).toEqual({ ok: true, valor: ['ramal:1', 'ramal:2', 'ramal:3'] });
  });
  it('hora completa o zero e aceita 24:00', () => {
    expect(lerCelula(col({ tipo: 'hora' }), '8:30')).toEqual({ ok: true, valor: '08:30' });
    expect(lerCelula(col({ tipo: 'hora' }), '24:00')).toEqual({ ok: true, valor: '24:00' });
    expect(lerCelula(col({ tipo: 'hora' }), '25:00')).toMatchObject({ ok: false });
  });
  it('data confere o calendário', () => {
    expect(lerCelula(col({ tipo: 'data' }), '2026-11-20')).toEqual({ ok: true, valor: '2026-11-20' });
    expect(lerCelula(col({ tipo: 'data' }), '2026-02-30')).toMatchObject({ ok: false });
  });
  it('dias aceita lista, nome por extenso e faixa', () => {
    expect(lerCelula(col({ tipo: 'dias' }), 'seg-sex')).toEqual({ ok: true, valor: ['seg', 'ter', 'qua', 'qui', 'sex'] });
    expect(lerCelula(col({ tipo: 'dias' }), 'Sábado, domingo')).toEqual({ ok: true, valor: ['dom', 'sab'] });
    expect(lerCelula(col({ tipo: 'dias' }), 'feriado')).toMatchObject({ ok: false });
  });
  it('expressão chave=valor', () => {
    expect(lerCelula(col({ tipo: 'expressao' }), 'Tipo = aluguel')).toEqual({ ok: true, valor: { chave: 'tipo', valor: 'aluguel' } });
    expect(lerCelula(col({ tipo: 'expressao' }), 'aluguel')).toMatchObject({ ok: false });
  });
  it('opção aceita tecla e palavra', () => {
    expect(lerCelula(col({ tipo: 'opcao' }), '#')).toEqual({ ok: true, valor: '#' });
    expect(lerCelula(col({ tipo: 'opcao' }), 'Não')).toEqual({ ok: true, valor: 'nao' });
    expect(lerCelula(col({ tipo: 'opcao' }), 'tecla 1')).toMatchObject({ ok: false });
  });
  it.each(NOMES_ABAS)('os exemplos de %s são válidos', (aba) => {
    for (const ex of ABAS[aba].exemplos) {
      for (const c of ABAS[aba].colunas) {
        const r = lerCelula(c, ex[c.nome]);
        if (r) expect(r, `${aba}.${c.nome}`).toMatchObject({ ok: true });
      }
    }
  });
});

describe('paraCelula', () => {
  it('converte valores tipados de volta pra texto', () => {
    expect(paraCelula(true)).toBe('sim');
    expect(paraCelula(['ramal:1', 'ramal:2'])).toBe('ramal:1 ramal:2');
    expect(paraCelula({ chave: 'tipo', valor: 'aluguel' })).toBe('tipo=aluguel');
    expect(paraCelula(20)).toBe('20');
    expect(paraCelula(undefined)).toBe('');
  });
});
