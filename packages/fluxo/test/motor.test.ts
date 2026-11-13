import { describe, expect, it } from 'vitest';
import { executar, simular, type Evento } from '../src/motor';
import type { Cadastro } from '../src/cadastros';
import { doc, liga, peca } from './apoio';

const tipos = (es: readonly Evento[]) => es.map((e) => e.tipo);
const ultimo = (es: readonly Evento[]) => es[es.length - 1]!;

const HORARIO: Cadastro = { id: 'h', tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] } };

describe('motor', () => {
  it('anda sozinho por uma saída só, somando o tempo das peças', () => {
    const d = doc([peca('i', 'inicio'), peca('m', 'mensagem', { tempo_s: 5 }), peca('e', 'etapa', { tempo_s: 60 }), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'e'), liga('e', 'f')]);
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.terminou).toBe(true);
    expect(ultimo(x.eventos)).toEqual({ tipo: 'terminou', motivo: 'fim', peca: 'f', relogio_s: 65 });
    expect(x.eventos.filter((e) => e.tipo === 'chegou').map((e) => (e as { relogio_s: number }).relogio_s)).toEqual([0, 0, 5, 65]);
    expect(x.eventos.filter((e) => e.tipo === 'escolheu').every((e) => (e as { quem: string }).quem === 'unica')).toBe(true);
  });

  it('mais de uma saída: pergunta, e a escolha segue pelo caminho', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao', { nome: 'Assunto?' }), peca('a', 'fim', { nome: 'Financeiro' }), peca('b', 'fim', { nome: 'Suporte' })],
      [liga('i', 'd'), liga('d', 'a', { id: 'op1', regra: 'opcao', valor: '1', rotulo: 'Financeiro' }), liga('d', 'b', { id: 'op2', regra: 'opcao', valor: '2' })],
    );
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.pendente).toEqual({
      peca: 'd',
      opcoes: [
        { conexao: 'op1', para: 'a', texto: '1 · Financeiro', regra: 'opcao', tempo_s: 0, sugerida: false },
        { conexao: 'op2', para: 'b', texto: '2', regra: 'opcao', tempo_s: 0, sugerida: false },
      ],
    });
    expect(tipos(x.avancar('op2'))).toEqual(['escolheu', 'correu', 'chegou', 'terminou']);
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'b' });
  });

  it('opção sem texto mostra o nome do destino', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim', { nome: 'A' }), peca('b', 'fim', { nome: 'B' })], [liga('i', 'a'), liga('i', 'b')]);
    expect(executar(d, {}, { inicio: 'i' }).pendente!.opcoes.map((o) => o.texto)).toEqual(['A', 'B']);
  });

  it('resposta que não é opção vira escolha_ignorada e não muda nada', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a'), liga('i', 'b')]);
    const x = executar(d, {}, { inicio: 'i' });
    const antes = x.eventos.length;
    expect(x.avancar('nao-existe')).toEqual([{ tipo: 'escolha_ignorada', resposta: 'nao-existe' }]);
    expect(x.pendente).not.toBeNull();
    expect(x.eventos).toHaveLength(antes);
    x.avancar('i>a');
    expect(x.avancar('i>b')).toEqual([{ tipo: 'escolha_ignorada', resposta: 'i>b' }]);
    expect(ultimo(x.eventos).tipo).toBe('terminou'); // depois do fim, nada entra
    expect(x.escolhas).toEqual(['i>a']);
  });

  it('a simulação não muda se o documento mudar depois', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a'), liga('i', 'b')]);
    const x = executar(d, {}, { inicio: 'i' });
    d.conexoes.splice(0, 1);
    x.avancar('i>a');
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'a' });
  });

  it('conexão "depois de um tempo" soma no relógio', () => {
    const d = doc([peca('i', 'inicio'), peca('w', 'espera'), peca('ok', 'fim'), peca('tarde', 'fim')], [liga('i', 'w'), liga('w', 'ok', { regra: 'condicao', valor: 'respondeu' }), liga('w', 'tarde', { id: 't', regra: 'tempo', tempo_s: 7200 })]);
    const x = executar(d, {}, { inicio: 'i' });
    expect(x.pendente!.opcoes.find((o) => o.conexao === 't')).toMatchObject({ texto: 'após 2 h', tempo_s: 7200 });
    x.avancar('t');
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'tarde', relogio_s: 7200 });
  });

  describe('relógio', () => {
    const d = doc(
      [peca('i', 'inicio', { tempo_s: 0 }), peca('h', 'decisao', { responsavel: 'h', tempo_s: 0 }), peca('aberto', 'fim'), peca('fechado', 'fim')],
      [liga('i', 'h'), liga('h', 'aberto', { id: 'dentro', regra: 'horario', horario: 'dentro' }), liga('h', 'fechado', { id: 'fora', regra: 'horario', horario: 'fora' })],
    );
    it('decide sozinho pela hora simulada', () => {
      expect(ultimo(executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T10:00' }).eventos)).toMatchObject({ peca: 'aberto' });
      const fora = executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-22T10:00' });
      expect(ultimo(fora.eventos)).toMatchObject({ peca: 'fechado' });
      expect(fora.eventos.find((e) => e.tipo === 'escolheu' && e.peca === 'h')).toMatchObject({ quem: 'relogio', conexao: 'fora' });
    });
    it('conta o tempo que já passou: chegar às 17h58 com 5 min de fila já é fora', () => {
      const comFila = { ...d, pecas: d.pecas.map((p) => (p.id === 'i' ? { ...p, tempo_s: 300 } : p)) };
      expect(ultimo(executar(comFila, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T17:58' }).eventos)).toMatchObject({ peca: 'fechado' });
    });
    it('no modo livre pergunta, com a escolha do relógio sugerida', () => {
      const x = executar(d, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T10:00', modo: 'livre' });
      expect(x.pendente!.opcoes.map((o) => [o.conexao, o.sugerida])).toEqual([['dentro', true], ['fora', false]]);
    });
    it('saída única de horário: o relógio decide; fora dela, não tem pra onde ir', () => {
      const so = doc([peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'h' }), peca('aberto', 'fim')], [liga('i', 'h'), liga('h', 'aberto', { id: 'dentro', regra: 'horario', horario: 'dentro' })]);
      expect(ultimo(executar(so, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T10:00' }).eventos)).toMatchObject({ motivo: 'fim', peca: 'aberto' });
      expect(ultimo(executar(so, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-22T03:00' }).eventos)).toMatchObject({ motivo: 'beco', peca: 'h' });
    });
    it('"senão" vale quando o lado da hora não tem saída', () => {
      const comSenao = { ...d, conexoes: [d.conexoes[0]!, d.conexoes[1]!, liga('h', 'fechado', { id: 'senao', regra: 'senao' })] };
      const x = executar(comSenao, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-22T10:00' });
      expect(x.eventos.find((e) => e.tipo === 'escolheu' && e.peca === 'h')).toMatchObject({ quem: 'relogio', conexao: 'senao' });
    });
    it('peça com saída de horário e opção de pessoa: pergunta', () => {
      const misto = { ...d, conexoes: [...d.conexoes, liga('h', 'fechado', { id: 'op', regra: 'opcao', valor: '1' })] };
      expect(executar(misto, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-22T10:00' }).pendente!.peca).toBe('h');
    });
    it('fechado, espera e tenta de novo: não é ciclo enquanto o tempo anda', () => {
      const tenta = doc(
        [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'h' }), peca('w', 'espera'), peca('ok', 'fim')],
        [liga('i', 'h'), liga('h', 'ok', { regra: 'horario', horario: 'dentro' }), liga('h', 'w', { regra: 'horario', horario: 'fora' }), liga('w', 'h', { regra: 'tempo', tempo_s: 3600 })],
      );
      expect(ultimo(executar(tenta, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T06:00' }).eventos)).toMatchObject({ motivo: 'fim', peca: 'ok', relogio_s: 7200 });
      const semTempo = { ...tenta, conexoes: tenta.conexoes.map((c) => (c.regra === 'tempo' ? { ...c, regra: 'sempre' as const, tempo_s: undefined } : c)) };
      expect(ultimo(executar(semTempo, { cadastros: [HORARIO] }, { inicio: 'i', quando: '2026-11-23T06:00' }).eventos)).toMatchObject({ motivo: 'ciclo', peca: 'h' });
    });
    it('sem hora ou sem o cadastro de horário, pergunta', () => {
      expect(executar(d, { cadastros: [HORARIO] }, { inicio: 'i' }).pendente).not.toBeNull();
      expect(executar(d, {}, { inicio: 'i', quando: '2026-11-23T10:00' }).pendente).not.toBeNull();
    });
  });

  it('o canal muda quando a peça diz; sem canal, segue o de antes', () => {
    const d = doc([peca('i', 'inicio', { canal: 'whatsapp' }), peca('m', 'mensagem'), peca('e', 'mensagem', { canal: 'email' }), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'e'), liga('e', 'f')]);
    const canais = executar(d, { canal: 'chat' }, { inicio: 'i' }).eventos.filter((e) => e.tipo === 'chegou').map((e) => (e as { canal: string }).canal);
    expect(canais).toEqual(['whatsapp', 'whatsapp', 'email', 'email']);
    expect(executar(doc([peca('i', 'inicio'), peca('f', 'fim')], [liga('i', 'f')]), { canal: 'chat' }, { inicio: 'i' }).canal).toBe('chat');
  });

  it('peça sem saída que não é Fim termina como beco', () => {
    const x = executar(doc([peca('i', 'inicio'), peca('e', 'etapa')], [liga('i', 'e')]), {}, { inicio: 'i' });
    expect(ultimo(x.eventos)).toMatchObject({ tipo: 'terminou', motivo: 'beco', peca: 'e' });
  });

  it('ciclo andando sozinho termina na terceira volta', () => {
    const x = executar(doc([peca('i', 'inicio'), peca('a', 'etapa'), peca('b', 'etapa')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'a')]), {}, { inicio: 'i' });
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'ciclo', peca: 'a' });
  });

  it('voltar por escolha de uma pessoa não é ciclo', () => {
    const d = doc([peca('i', 'inicio'), peca('m', 'decisao'), peca('f', 'fim')], [liga('i', 'm'), liga('m', 'm', { id: 'repete', regra: 'opcao', valor: '9' }), liga('m', 'f', { id: 'sai', regra: 'opcao', valor: '1' })]);
    const x = simular(d, {}, { inicio: 'i', escolhas: ['repete', 'repete', 'repete', 'repete', 'sai'] });
    expect(ultimo(x.eventos)).toMatchObject({ motivo: 'fim', peca: 'f' });
  });

  it('fluxo comprido não estoura a pilha', () => {
    const n = 20_000;
    const d = doc([peca('i', 'inicio'), ...Array.from({ length: n }, (_, k) => peca(`p${k}`, 'etapa')), peca('f', 'fim')], [liga('i', 'p0'), ...Array.from({ length: n - 1 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), liga(`p${n - 1}`, 'f')]);
    expect(ultimo(executar(d, {}, { inicio: 'i' }).eventos)).toMatchObject({ tipo: 'terminou', motivo: 'limite' }); // a trava de passos
  });

  it('início que não existe termina na hora', () => {
    expect(executar(doc([]), {}, { inicio: 'x' }).eventos).toEqual([{ tipo: 'terminou', motivo: 'inexistente', peca: null, relogio_s: 0 }]);
  });

  it('refazer para na primeira escolha que não serve mais', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('m', 'decisao'), peca('n', 'decisao'), peca('f', 'fim')],
      [liga('i', 'm'), liga('m', 'n', { id: 'vai_novo', regra: 'opcao', valor: '2' }), liga('n', 'm', { id: 'volta' }), liga('n', 'f', { id: 'fica', regra: 'opcao', valor: '9' }), liga('m', 'f', { id: 'sai', regra: 'opcao', valor: '1' })],
    );
    const x = simular(d, {}, { inicio: 'i', escolhas: ['vai', 'volta', 'sai'] }); // "vai" não existe mais
    expect(x.escolhas).toEqual([]);
    expect(x.pendente!.peca).toBe('m');
  });

  it('previsível: as mesmas escolhas dão os mesmos eventos', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a'), liga('i', 'b')]);
    expect(simular(d, {}, { inicio: 'i', escolhas: ['i>b'] }).eventos).toEqual(simular(d, {}, { inicio: 'i', escolhas: ['i>b'] }).eventos);
  });

  it('data inválida é erro de quem chama', () => {
    expect(() => executar(doc([peca('i', 'inicio')]), {}, { inicio: 'i', quando: 'ontem' })).toThrow('AAAA-MM-DDTHH:MM');
  });
});
