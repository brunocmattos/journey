import { describe, expect, it } from 'vitest';
import { documentoVazio, type Documento } from '@journey/fluxo';
import { apagar, conteudoDoGrupo, criarGrupo, criarLigada, criarNota, criarPeca, duplicar, existe, inverterConexao, ligar, moverGrupo, mudarConexao, mudarPeca, redimensionarGrupo } from '@/editor/documento';

const base = (): Documento => {
  let d = criarPeca(documentoVazio(), 'a', 'inicio', 95, 30);
  d = criarPeca(d, 'b', 'etapa', 400, 30);
  d = criarPeca(d, 'c', 'fim', 700, 30);
  return d;
};
const ligado = (d: Documento, id: string, de: string, para: string) => {
  const r = ligar(d, id, de, para);
  if (!('doc' in r)) throw new Error(r.erro);
  return r.doc;
};

describe('editor/documento', () => {
  it('peça nova: centro onde clicou, na grade, com o nome do tipo', () => {
    const d = criarPeca(documentoVazio(), 'p', 'decisao', 104, 207);
    expect(d.pecas).toEqual([{ id: 'p', tipo: 'decisao', nome: 'Decisão', x: 30, y: 140 }]);
  });

  it('não muda o documento de entrada', () => {
    const d = base();
    const copia = structuredClone(d);
    mudarPeca(ligado(d, 'x', 'a', 'b'), 'a', { nome: 'Outro' });
    expect(d).toEqual(copia);
  });

  it('ligar: uma saída é "sempre"; a segunda vira opções 1 e 2', () => {
    let d = ligado(base(), 'c1', 'a', 'b');
    expect(d.conexoes).toEqual([{ id: 'c1', de: 'a', para: 'b', regra: 'sempre' }]);
    d = ligado(d, 'c2', 'a', 'c');
    expect(d.conexoes.map((c) => [c.id, c.regra, c.valor])).toEqual([['c1', 'opcao', '1'], ['c2', 'opcao', '2']]);
  });

  it('ligar: saída com texto ou outra regra não vira opção', () => {
    let d = ligado(base(), 'c1', 'a', 'b');
    d = mudarConexao(d, 'c1', { regra: 'condicao', valor: 'pago' });
    d = ligado(d, 'c2', 'a', 'c');
    expect(d.conexoes.map((c) => [c.regra, c.valor])).toEqual([['condicao', 'pago'], ['opcao', '2']]);
  });

  it('ligar recusa a mesma peça, ligação repetida e peça que não existe', () => {
    const d = ligado(base(), 'c1', 'a', 'b');
    expect(ligar(d, 'x', 'a', 'a')).toEqual({ erro: 'mesma' });
    expect(ligar(d, 'x', 'a', 'b')).toEqual({ erro: 'repetida' });
    expect(ligar(d, 'x', 'a', 'z')).toEqual({ erro: 'inexistente' });
  });

  it('criar a próxima já ligada: à direita, uma linha abaixo por saída que já existe', () => {
    let d = criarLigada(base(), 'n1', 'k1', 'b', 'mensagem');
    d = criarLigada(d, 'n2', 'k2', 'b', 'fim');
    const [n1, n2] = [d.pecas.find((p) => p.id === 'n1')!, d.pecas.find((p) => p.id === 'n2')!];
    expect([n1.x, n1.y, n2.x, n2.y]).toEqual([620, 0, 620, 110]);
    expect(d.conexoes.filter((c) => c.de === 'b').map((c) => c.regra)).toEqual(['opcao', 'opcao']);
  });

  it('trocar o tipo mantém o centro e as ligações', () => {
    const d = mudarPeca(ligado(base(), 'c1', 'a', 'b'), 'b', { tipo: 'decisao' });
    const b = d.pecas.find((p) => p.id === 'b')!;
    expect([b.x, b.y]).toEqual([340, -40]);
    expect(d.conexoes).toHaveLength(1);
  });

  it('campo vazio some da peça; nome vazio volta pro nome do tipo', () => {
    let d = mudarPeca(base(), 'b', { canal: 'email', responsavel: 'k1' });
    d = mudarPeca(d, 'b', { canal: undefined, responsavel: '', nome: '' });
    expect(d.pecas.find((p) => p.id === 'b')).toEqual({ id: 'b', tipo: 'etapa', nome: 'Etapa', x: 300, y: 0 });
  });

  it('trocar a regra limpa os campos da regra anterior; horário começa em "dentro"', () => {
    let d = mudarConexao(ligado(base(), 'c1', 'a', 'b'), 'c1', { regra: 'tempo', tempo_s: 60 });
    d = mudarConexao(d, 'c1', { regra: 'horario' });
    expect(d.conexoes[0]).toEqual({ id: 'c1', de: 'a', para: 'b', regra: 'horario', horario: 'dentro' });
    expect(inverterConexao(d, 'c1').conexoes[0]).toMatchObject({ de: 'b', para: 'a' });
  });

  it('grupo leva junto o que tem o centro dentro dele, a partir de onde o arrasto começou', () => {
    let d = criarGrupo(base(), 'g', 240, 30);
    d = criarNota(d, 'n', 1500, 1500);
    const levar = conteudoDoGrupo(d, 'g');
    expect(levar).toEqual({ pecas: ['a', 'b'], notas: [] });
    const m = moverGrupo(d, 'g', 47, 13, levar);
    expect(m.pecas.map((p) => [p.id, p.x, p.y])).toEqual([['a', 50, 10], ['b', 350, 10], ['c', 610, 0]]);
    expect(m.grupos[0]).toMatchObject({ x: 90, y: -80 });
    expect(redimensionarGrupo(m, 'g', 20, 20).grupos[0]).toMatchObject({ w: 160, h: 100 });
  });

  it('apagar peça leva as ligações; duplicar não', () => {
    let d = ligado(ligado(base(), 'c1', 'a', 'b'), 'c2', 'b', 'c');
    expect(apagar(d, { tipo: 'peca', id: 'b' }).conexoes).toEqual([]);
    d = duplicar(d, 'b', 'b2');
    expect(d.pecas.at(-1)).toMatchObject({ id: 'b2', x: 330, y: 30 });
    expect(d.conexoes).toHaveLength(2);
    expect(existe(d, { tipo: 'conexao', id: 'c2' })).toBe(true);
    expect(existe(apagar(d, { tipo: 'conexao', id: 'c2' }), { tipo: 'conexao', id: 'c2' })).toBe(false);
  });
});
