import { describe, expect, it } from 'vitest';
import { diagnosticar, fnv1a64, resumirChave } from '../src/diagnostico';
import { doc, liga, peca } from './apoio';

const chaves = (...args: Parameters<typeof diagnosticar>) => diagnosticar(...args).map((a) => a.chave);
const HORARIO = { id: 'h', tipo: 'horario', nome: 'Comercial', campos: { janelas: [], feriados: [] } };

describe('diagnóstico', () => {
  it('fluxo limpo não tem achado', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim')], [liga('i', 'f')]))).toEqual([]);
    expect(chaves(doc([]))).toEqual([]);
  });

  it('sem Início', () => {
    expect(chaves(doc([peca('f', 'fim')]))).toEqual(['sem_inicio:fluxo']);
  });

  it('beco sem saída e Início que não termina', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('e', 'etapa')], [liga('i', 'e')]))).toEqual(['beco_sem_saida:e', 'nao_termina:i']);
  });

  it('peça que ninguém alcança', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('f', 'fim'), peca('solta', 'fim')], [liga('i', 'f')]))).toEqual(['inalcancavel:solta']);
  });

  it('ciclo sem saída, e ciclo com saída não é achado', () => {
    const preso = doc([peca('i', 'inicio'), peca('a', 'etapa'), peca('b', 'etapa'), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'a')]);
    expect(chaves(preso)).toEqual(['ciclo_sem_saida:a+b', 'nao_termina:i', 'inalcancavel:f']);
    const comSaida = doc(preso.pecas, [liga('i', 'a'), liga('a', 'b'), liga('b', 'a', { regra: 'opcao', valor: '2' }), liga('b', 'f', { regra: 'opcao', valor: '1' })]);
    expect(chaves(comSaida).filter((k) => k.startsWith('ciclo'))).toEqual([]);
  });

  it('laço numa peça só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('a', 'etapa')], [liga('i', 'a'), liga('a', 'a')]))).toContain('ciclo_sem_saida:a');
  });

  it('decisão com uma saída só', () => {
    expect(chaves(doc([peca('i', 'inicio'), peca('d', 'decisao'), peca('f', 'fim')], [liga('i', 'd'), liga('d', 'f')]))).toEqual(['decisao_sem_escolha:d']);
  });

  it('opções repetidas na mesma peça', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
      [liga('i', 'd'), liga('d', 'a', { regra: 'opcao', valor: '1' }), liga('d', 'b', { regra: 'opcao', valor: '1' })],
    );
    expect(diagnosticar(d)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:d>a+d>b', refs: ['d', 'd>a', 'd>b'] })]);
  });

  it('a chave das opções repetidas é feita dos ids, nunca do texto da condição', () => {
    // A condição é texto livre: pode ter o nome de uma pessoa (e o link esconde nomes) ou emoji.
    const valor = `pediu a Ana Souza ${'😀'.repeat(40)}`;
    const d = doc(
      [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim')],
      [liga('i', 'd'), liga('d', 'b', { id: 'z', regra: 'condicao', valor }), liga('d', 'a', { id: 'y', regra: 'condicao', valor })],
    );
    const k = chaves(d)[0]!;
    expect(k).toBe('opcoes_repetidas:d:y+z');
    // Texto diferente depois dos primeiros 60 caracteres não é a mesma condição.
    const diferentes = doc(d.pecas, [liga('i', 'd'), liga('d', 'b', { regra: 'condicao', valor: `${'x'.repeat(60)}1` }), liga('d', 'a', { regra: 'condicao', valor: `${'x'.repeat(60)}2` })]);
    expect(chaves(diferentes)).toEqual([]);
  });

  it('regra pela metade', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'fim'), peca('b', 'fim')], [liga('i', 'a', { regra: 'condicao' }), liga('i', 'b', { regra: 'opcao', valor: '2' })]);
    expect(chaves(d)).toEqual(['regra_vazia:i>a']);
  });

  it('atendimento sem responsável e responsável que não existe', () => {
    const d = doc([peca('i', 'inicio'), peca('a', 'atendimento'), peca('b', 'atendimento', { responsavel: 'k9' }), peca('f', 'fim')], [liga('i', 'a'), liga('a', 'b'), liga('b', 'f')]);
    expect(chaves(d)).toEqual(['sem_responsavel:a']);
    expect(chaves(d, { cadastros: [] })).toEqual(['responsavel_inexistente:b', 'sem_responsavel:a']);
  });

  it('decisão de horário sem um cadastro Horário', () => {
    const pecas = [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'k1' }), peca('a', 'fim'), peca('b', 'fim')];
    const conexoes = [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' as const }), liga('h', 'b', { regra: 'horario', horario: 'fora' as const })];
    expect(chaves(doc(pecas, conexoes), { cadastros: [{ id: 'k1', tipo: 'fila', nome: 'Fila' }] })).toEqual(['horario_sem_cadastro:h']);
    const comH = doc(pecas.map((p) => (p.id === 'h' ? { ...p, responsavel: 'h' } : p)), conexoes);
    expect(chaves(comH, { cadastros: [HORARIO] })).toEqual([]);
    expect(chaves(comH, { cadastros: [{ ...HORARIO, campos: { janelas: [{ dias: ['seg'], inicio: '18:00', fim: '08:00' }] } }] })).toEqual(['horario_invalido:h']);
  });

  it('caminho mais longo acima da meta', () => {
    const d = doc(
      [peca('i', 'inicio'), peca('a', 'atendimento', { responsavel: 'k', tempo_s: 3600 }), peca('w', 'espera'), peca('f', 'fim')],
      [liga('i', 'a'), liga('a', 'w'), liga('w', 'f', { regra: 'tempo', tempo_s: 7200 })],
    );
    expect(chaves(d, { meta_s: 4 * 3600 })).toEqual([]);
    const [a] = diagnosticar(d, { meta_s: 2 * 3600 });
    expect(a).toMatchObject({ chave: 'passou_do_prazo:fluxo', refs: ['i', 'a', 'w', 'f'] });
    expect(a!.texto).toContain('3 h');
  });

  it('Fim encerra: as saídas dele não levam ninguém', () => {
    const d = doc([peca('i', 'inicio'), peca('f', 'fim'), peca('x', 'etapa'), peca('g', 'fim')], [liga('i', 'f'), liga('f', 'x'), liga('x', 'g')]);
    expect(chaves(d)).toEqual(['inalcancavel:g', 'inalcancavel:x', 'fim_com_saida:f']);
  });

  it('Início sem saída é um achado só', () => {
    expect(chaves(doc([peca('i', 'inicio')]))).toEqual(['beco_sem_saida:i']);
  });

  it('decisão só de horário precisa dos dois lados (ou de um senão)', () => {
    const pecas = [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'h' }), peca('a', 'fim'), peca('b', 'fim')];
    expect(chaves(doc(pecas, [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' })]), { cadastros: [HORARIO] })).toEqual(['horario_sem_lado:h:fora', 'inalcancavel:b']);
    expect(chaves(doc(pecas, [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' }), liga('h', 'b', { regra: 'senao' })]), { cadastros: [HORARIO] })).toEqual([]);
    expect(chaves(doc(pecas, [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' }), liga('h', 'b', { regra: 'horario', horario: 'fora' })]))).toEqual([]);
    expect(chaves(doc([peca('i', 'inicio'), peca('h', 'decisao'), peca('a', 'fim')], [liga('i', 'h'), liga('h', 'a', { regra: 'horario', horario: 'dentro' })]))).toEqual(['horario_sem_cadastro:h', 'horario_sem_lado:h:fora']);
  });

  it('"fechado, tenta de novo" sem tempo de espera é ciclo sem espera', () => {
    const pecas = [peca('i', 'inicio'), peca('h', 'decisao', { responsavel: 'h' }), peca('w', 'espera'), peca('ok', 'fim')];
    const conexoes = [liga('i', 'h'), liga('h', 'ok', { regra: 'horario', horario: 'dentro' }), liga('h', 'w', { regra: 'horario', horario: 'fora' }), liga('w', 'h')];
    expect(chaves(doc(pecas, conexoes), { cadastros: [HORARIO] })).toEqual(['ciclo_sem_tempo:h+w']);
    const comTempo = conexoes.map((c) => (c.de === 'w' ? { ...c, regra: 'tempo' as const, tempo_s: 3600 } : c));
    expect(chaves(doc(pecas, comTempo), { cadastros: [HORARIO] })).toEqual([]);
    const comEscolha = [...conexoes, liga('w', 'ok', { regra: 'opcao', valor: '1' })];
    expect(chaves(doc(pecas, comEscolha), { cadastros: [HORARIO] }).filter((k) => k.startsWith('ciclo'))).toEqual([]);
  });

  it('saídas iguais: um achado por grupo, inclusive "senão" repetido', () => {
    const pecas = [peca('i', 'inicio'), peca('d', 'decisao'), peca('a', 'fim'), peca('b', 'fim'), peca('c', 'fim')];
    const tres = doc(pecas, [liga('i', 'd'), ...['a', 'b', 'c'].map((x) => liga('d', x, { regra: 'opcao', valor: '1' }))]);
    expect(diagnosticar(tres)).toEqual([expect.objectContaining({ chave: 'opcoes_repetidas:d:d>a+d>b+d>c', refs: ['d', 'd>a', 'd>b', 'd>c'] })]);
    const senoes = doc(pecas, [liga('i', 'd'), liga('d', 'a', { regra: 'condicao', valor: 'pago' }), liga('d', 'b', { regra: 'senao' }), liga('d', 'c', { regra: 'senao' })]);
    expect(chaves(senoes)).toEqual(['opcoes_repetidas:d:d>b+d>c']);
  });

  describe('caminho mais longo com muitos caminhos', () => {
    // De A, 20 decisões em losango (2^20 caminhos, todos rápidos); de B, um atendimento de 10 dias.
    const losangos = (comVolta: boolean) => {
      const pecas = [peca('A', 'inicio'), peca('B', 'inicio'), peca('lento', 'atendimento', { responsavel: 'k', tempo_s: 10 * 86400 }), peca('f', 'fim')];
      const conexoes = [liga('B', 'lento'), liga('lento', 'f'), liga('A', 's0')];
      for (let k = 0; k < 20; k++) {
        pecas.push(peca(`s${k}`, 'decisao'), peca(`a${k}`, 'etapa'), peca(`b${k}`, 'etapa'));
        const prox = k === 19 ? 'f' : `s${k + 1}`;
        conexoes.push(liga(`s${k}`, `a${k}`, { regra: 'opcao', valor: '1' }), liga(`s${k}`, `b${k}`, { regra: 'opcao', valor: '2' }), liga(`a${k}`, prox), liga(`b${k}`, prox));
      }
      if (comVolta) conexoes.push(liga('a19', 's0', { regra: 'opcao', valor: '9' }));
      return doc(pecas, conexoes);
    };
    const invertido = (d: ReturnType<typeof doc>) => ({ ...d, pecas: [...d.pecas].reverse(), conexoes: [...d.conexoes].reverse() });
    it('sem ciclo é exato e não depende da ordem do documento', () => {
      const d = losangos(false);
      for (const x of [d, invertido(d)]) {
        const a = diagnosticar(x, { meta_s: 86400 }).find((y) => y.tipo === 'passou_do_prazo')!;
        expect(a.refs).toEqual(['B', 'lento', 'f']);
        expect(a.texto).not.toContain('estimativa');
      }
    });
    it('com ciclo, cada Início tem sua busca; no teto, avisa que é estimativa', () => {
      const d = losangos(true);
      for (const x of [d, invertido(d)]) {
        const a = diagnosticar(x, { meta_s: 86400 }).find((y) => y.tipo === 'passou_do_prazo')!;
        expect(a.refs).toEqual(['B', 'lento', 'f']);
        expect(a.texto).toContain('estimativa');
      }
    });
  });

  it('ordem: grave, alerta, observação; a chave não depende do nome', () => {
    const d = doc([peca('i', 'inicio'), peca('e', 'etapa', { nome: 'X' }), peca('s', 'atendimento'), peca('f', 'fim')], [liga('i', 'e')]);
    const g = diagnosticar(d).map((a) => a.gravidade);
    expect(g).toEqual([...g].sort((a, b) => ['grave', 'alerta', 'observacao'].indexOf(a) - ['grave', 'alerta', 'observacao'].indexOf(b)));
    const renomeado = { ...d, pecas: d.pecas.map((p) => ({ ...p, nome: `${p.nome}!` })) };
    expect(chaves(renomeado)).toEqual(chaves(d));
  });

  it('caminho comprido não estoura a pilha', () => {
    const n = 20_000;
    const d = doc([peca('i', 'inicio'), ...Array.from({ length: n }, (_, k) => peca(`p${k}`, 'etapa', { tempo_s: 1 })), peca('f', 'fim')], [liga('i', 'p0'), ...Array.from({ length: n - 1 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), liga(`p${n - 1}`, 'f')]);
    expect(chaves(d, { meta_s: 60 })).toEqual(['passou_do_prazo:fluxo']);
  });

  it('500 peças em menos de 100 ms', () => {
    const pecas = [peca('i', 'inicio'), ...Array.from({ length: 498 }, (_, k) => peca(`p${k}`, k % 7 === 0 ? 'decisao' : 'etapa')), peca('f', 'fim')];
    const conexoes = [liga('i', 'p0'), ...Array.from({ length: 497 }, (_, k) => liga(`p${k}`, `p${k + 1}`)), ...Array.from({ length: 70 }, (_, k) => liga(`p${k * 7}`, 'f', { regra: 'opcao', valor: '9' })), liga('p497', 'f')];
    const d = doc(pecas, conexoes);
    const t0 = performance.now();
    diagnosticar(d, { meta_s: 60 });
    expect(performance.now() - t0).toBeLessThan(100);
  });

  describe('chave comprida', () => {
    // Um ciclo junta os ids de todas as peças dele: a chave cresce com o ciclo, e o banco guarda a chave do intencional.
    const ciclo = (n: number, prefixo = 'p') => {
      const ids = Array.from({ length: n }, (_, i) => `${prefixo}-${String(i).padStart(3, '0')}`);
      return doc(
        [peca('i', 'inicio'), ...ids.map((id) => peca(id, 'etapa'))],
        [liga('i', ids[0]!), ...ids.map((id, k) => liga(id, ids[(k + 1) % n]!))],
      );
    };
    const doCiclo = (d: ReturnType<typeof ciclo>) => chaves(d).find((k) => k.startsWith('ciclo_sem_saida:'))!;

    it('curta fica como é', () => {
      expect(doCiclo(ciclo(3))).toBe('ciclo_sem_saida:p-000+p-001+p-002');
    });

    it('o título de um ciclo grande cita alguns nomes e conta o resto', () => {
      const titulo = diagnosticar(ciclo(2000)).find((a) => a.tipo === 'ciclo_sem_saida')!.titulo;
      expect(titulo).toBe('Ciclo sem saída: p-000, p-001, p-002, p-003, p-004 e mais 1995');
      expect(diagnosticar(ciclo(5)).find((a) => a.tipo === 'ciclo_sem_saida')!.titulo).toBe('Ciclo sem saída: p-000, p-001, p-002, p-003, p-004');
    });

    it('comprida vira o começo mais um resumo: curta, estável e diferente pra outro ciclo', () => {
      const k = doCiclo(ciclo(300));
      expect(k.length).toBeLessThanOrEqual(120);
      expect(k.startsWith('ciclo_sem_saida:p-000+p-001+')).toBe(true);
      expect(k).toMatch(/~[0-9a-f]{16}$/);
      expect(doCiclo(ciclo(300))).toBe(k);
      expect(doCiclo(ciclo(301))).not.toBe(k);
      expect(doCiclo(ciclo(300, 'q'))).not.toBe(k);
    });

    it('o resumo é o FNV-1a de 64 bits do texto inteiro', () => {
      const longo = 'x'.repeat(201);
      expect(resumirChave('a'.repeat(200))).toBe('a'.repeat(200));
      expect(resumirChave(longo)).toBe(`${'x'.repeat(80)}~${fnv1a64('x'.repeat(201))}`);
      // Vetores conhecidos do FNV-1a de 64 bits.
      expect(fnv1a64('')).toBe('cbf29ce484222325');
      expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
      expect(fnv1a64('foobar')).toBe('85944171f73967e8');
    });

    it('não corta um caractere no meio', () => {
      const k = resumirChave('😀'.repeat(150));
      expect(k.startsWith('😀'.repeat(80) + '~')).toBe(true);
    });
  });
});
