import { describe, expect, it } from 'vitest';
import { descreverLink, ehValidade, enderecoDoLink, escolhasDoFormulario, expiraEm, situacao, type LinkResumo } from '@/compartilhar/opcoes';

const AGORA = new Date('2026-11-12T15:00:00Z');
const base: LinkResumo = {
  id: 'l1',
  token: 'abcdefghijklmnopqrstuvwx',
  versao: null,
  esconder_nomes: true,
  cenario_nome: null,
  expira_em: null,
  revogado_em: null,
  criado_em: '2026-11-12T12:00:00Z',
};

describe('opções do link', () => {
  it('validade: 7, 30, 90 dias ou sem prazo', () => {
    expect([7, 30, 90, null].every(ehValidade)).toBe(true);
    expect(ehValidade(1)).toBe(false);
    expect(ehValidade('30')).toBe(false);
    expect(expiraEm(7, AGORA)).toBe('2026-11-19T15:00:00.000Z');
    expect(expiraEm(null, AGORA)).toBeNull();
  });

  it('situação: revogado vale mais que vencido', () => {
    expect(situacao(base, AGORA)).toBe('ativo');
    expect(situacao({ ...base, expira_em: '2026-11-12T14:59:00Z' }, AGORA)).toBe('vencido');
    expect(situacao({ ...base, expira_em: '2026-11-12T14:59:00Z', revogado_em: '2026-11-12T13:00:00Z' }, AGORA)).toBe('revogado');
  });

  it('descreve em uma linha, com a data de São Paulo', () => {
    expect(descreverLink(base, AGORA)).toBe('o fluxo de agora · nomes escondidos · sem cenário · sem prazo');
    expect(descreverLink({ ...base, versao: 3, esconder_nomes: false, cenario_nome: 'E se?', expira_em: '2026-12-13T02:00:00Z' }, AGORA)).toBe(
      'versão 3 · com os nomes · cenário “E se?” · vale até 12/12/2026',
    );
    expect(descreverLink({ ...base, revogado_em: '2026-11-12T13:00:00Z' }, AGORA)).toContain('revogado em 12/11/2026');
    expect(descreverLink({ ...base, expira_em: '2026-11-10T13:00:00Z' }, AGORA)).toContain('venceu em 10/11/2026');
  });

  it('endereço', () => {
    expect(enderecoDoLink('https://journey.exemplo.com', 'abc')).toBe('https://journey.exemplo.com/l/abc');
  });

  it('o formulário vira as opções do link', () => {
    expect(escolhasDoFormulario({ versao: '', cenario: '', esconder: true, validade: '30' })).toEqual({ versao: null, cenarioId: null, esconderNomes: true, validade: 30 });
    expect(escolhasDoFormulario({ versao: '3', cenario: 'k1', esconder: false, validade: 'sem' })).toEqual({ versao: 3, cenarioId: 'k1', esconderNomes: false, validade: null });
    // Validade fora da lista volta pro padrão.
    expect(escolhasDoFormulario({ versao: '', cenario: '', esconder: true, validade: '1' }).validade).toBe(30);
  });
});
