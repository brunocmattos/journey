import { describe, expect, it } from 'vitest';
import { lerDocumento } from '../src/validar';
import { doc, liga, peca } from './apoio';

const codigos = (entrada: unknown, conhecidos = {}) => lerDocumento(entrada, conhecidos).problemas.map((p) => p.codigo);

describe('lerDocumento', () => {
  it('aceita um documento válido e devolve uma cópia só com os campos conhecidos', () => {
    const entrada = { ...doc([{ ...peca('a', 'inicio'), extra: 'x', canal: ' whatsapp ' } as never, peca('b', 'fim')], [liga('a', 'b')]), lixo: 1 };
    const r = lerDocumento(entrada);
    expect(r.problemas).toEqual([]);
    expect(r.documento).toEqual({
      formato: 'journey/2',
      pecas: [{ id: 'a', tipo: 'inicio', nome: 'a', x: 0, y: 0, canal: 'whatsapp' }, { id: 'b', tipo: 'fim', nome: 'b', x: 0, y: 0 }],
      conexoes: [{ id: 'a>b', de: 'a', para: 'b', regra: 'sempre' }],
      grupos: [],
      notas: [],
    });
  });

  it('recusa o que não é journey/2', () => {
    expect(codigos(null)).toEqual(['forma']);
    expect(codigos({ formato: 'journey/1', pecas: [], conexoes: [], grupos: [], notas: [] })).toEqual(['formato']);
    expect(codigos({ formato: 'journey/2', pecas: [] })).toEqual(['forma', 'forma', 'forma']);
    expect(lerDocumento(null).documento).toBeNull();
  });

  it('ids: faltando e repetidos, inclusive entre listas', () => {
    expect(codigos(doc([peca('a', 'inicio'), peca('a', 'fim')]))).toContain('id_repetido');
    expect(codigos(doc([{ tipo: 'fim', nome: 'x', x: 0, y: 0 } as never]))).toContain('id');
    expect(codigos(doc([peca('a', 'inicio'), peca('b', 'fim')], [liga('a', 'b', { id: 'a' })]))).toEqual(['id_repetido']);
    expect(codigos({ ...doc([peca('a', 'inicio')]), notas: [{ id: 'a', texto: '', x: 0, y: 0, w: 1, h: 1 }] })).toEqual(['id_repetido']);
  });

  it('limites: tamanho das listas, dos textos e do tempo', () => {
    const muitas = Array.from({ length: 2001 }, (_, k) => peca(`p${k}`, 'etapa'));
    expect(codigos(doc(muitas))).toEqual(['tamanho']);
    expect(codigos(doc([peca('a', 'etapa', { nome: 'x'.repeat(5001) })]))).toEqual(['tamanho']);
    expect(codigos(doc([peca('a', 'etapa', { tempo_s: 366 * 86400 })]))).toEqual(['tempo']);
    expect(codigos(doc([peca('a', 'etapa', { tempo_s: Infinity })]))).toEqual(['tempo']);
    expect(codigos(doc([peca('a', 'inicio'), peca('b', 'fim')], [liga('a', 'b', { regra: 'tempo', tempo_s: 8.7e12 })]))).toEqual(['tempo']);
    const grande = doc(Array.from({ length: 1500 }, (_, k) => peca(`p${k}`, 'etapa', { descricao: 'x'.repeat(4500) })));
    expect(codigos(grande)).toEqual(['tamanho']);
  });

  it('id de cadastro em maiúsculas vira minúsculas', () => {
    const u = '6ADA6878-0000-4000-8000-00000000000A';
    expect(lerDocumento(doc([peca('a', 'etapa', { responsavel: u })])).documento!.pecas[0]!.responsavel).toBe(u.toLowerCase());
    expect(lerDocumento(doc([peca('a', 'etapa', { responsavel: 'Fila-X' })])).documento!.pecas[0]!.responsavel).toBe('Fila-X');
  });

  it('a cópia guarda os campos de cada coisa e não depende da entrada', () => {
    const entrada = {
      ...doc(
        [peca('a', 'decisao', { descricao: ' d ', cor: '#fff', responsavel: 'k1', tempo_s: 30 }), peca('b', 'fim')],
        [liga('a', 'b', { regra: 'opcao', valor: 1 as never, rotulo: 'Um' }), liga('b', 'a', { id: 'h', regra: 'horario', horario: 'dentro' })],
      ),
      grupos: [{ id: 'g', nome: 'G', x: 1, y: 2, w: 3, h: 4, cor: '#000' }],
      notas: [{ id: 'n', texto: 'oi', x: 1, y: 2, w: 3, h: 4 }],
    };
    const r = lerDocumento(entrada).documento!;
    expect(r.pecas[0]).toEqual({ id: 'a', tipo: 'decisao', nome: 'a', x: 0, y: 0, descricao: 'd', cor: '#fff', responsavel: 'k1', tempo_s: 30 });
    expect(r.conexoes).toEqual([{ id: 'a>b', de: 'a', para: 'b', regra: 'opcao', valor: '1', rotulo: 'Um' }, { id: 'h', de: 'b', para: 'a', regra: 'horario', horario: 'dentro' }]);
    expect(r.grupos).toEqual(entrada.grupos);
    expect(r.notas).toEqual(entrada.notas);
    entrada.pecas[0]!.nome = 'mudou';
    entrada.grupos[0]!.w = 99;
    expect(r.pecas[0]!.nome).toBe('a');
    expect(r.grupos[0]!.w).toBe(3);
  });

  it('peça: tipo, nome, posição e tempo', () => {
    expect(codigos(doc([peca('a', 'menu' as never)]))).toEqual(['tipo']);
    expect(codigos(doc([peca('a', 'etapa', { nome: '  ' })]))).toEqual(['nome']);
    expect(codigos(doc([{ ...peca('a', 'etapa'), x: 'a' } as never]))).toEqual(['posicao']);
    expect(codigos(doc([peca('a', 'etapa', { tempo_s: -1 })]))).toEqual(['tempo']);
    expect(lerDocumento(doc([peca('a', 'etapa', { tempo_s: 0 })])).documento!.pecas[0]).not.toHaveProperty('tempo_s');
    expect(lerDocumento(doc([peca('a', 'etapa', { tempo_s: 12.4 })])).documento!.pecas[0]!.tempo_s).toBe(12);
  });

  it('conexão: pontas que não existem, regra, tempo e horário', () => {
    const base = [peca('a', 'inicio'), peca('b', 'fim')];
    expect(codigos(doc(base, [liga('a', 'x')]))).toEqual(['para']);
    expect(codigos(doc(base, [liga('x', 'b')]))).toEqual(['de']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'talvez' as never })]))).toEqual(['regra']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'tempo' })]))).toEqual(['tempo']);
    expect(codigos(doc(base, [liga('a', 'b', { regra: 'horario' })]))).toEqual(['horario']);
    expect(lerDocumento(doc(base, [{ id: 'c', de: 'a', para: 'b' } as never])).documento!.conexoes[0]!.regra).toBe('sempre');
  });

  it('grupos e notas precisam de posição e tamanho', () => {
    const d = { ...doc([]), grupos: [{ id: 'g', nome: 'G', x: 0, y: 0, w: 0, h: 10 }], notas: [{ id: 'n', texto: 'oi', x: 0, y: 0, w: 10, h: 10 }] };
    expect(codigos(d)).toEqual(['posicao']);
  });

  it('canal e cadastro que a empresa não tem são aviso, não erro', () => {
    const d = doc([peca('a', 'atendimento', { canal: 'fax', responsavel: 'k9' })]);
    const r = lerDocumento(d, { canais: ['whatsapp'], cadastros: ['k1'] });
    expect(r.problemas.map((p) => [p.gravidade, p.codigo])).toEqual([['aviso', 'canal'], ['aviso', 'responsavel']]);
    expect(r.documento).not.toBeNull();
  });
});
