import { describe, expect, it } from 'vitest';
import { diagnosticar, type Documento } from '@journey/fluxo';
import { ESTILO_PADRAO } from '@/editor/estilo';
import { montarRetrato, PESSOA, pessoasEscondidas, rotuloDaVersao, trocadorDeNomes, type LinkDoBanco } from '@/compartilhar/retrato';

const ANA = 'a0000000-0000-0000-0000-000000000001';
const ANA_PAULA = 'a0000000-0000-0000-0000-000000000002';
const SEM_USO = 'a0000000-0000-0000-0000-000000000003';
const FILA = 'f0000000-0000-0000-0000-000000000001';

const DOC: Documento = {
  formato: 'journey/2',
  pecas: [
    { id: 'i', tipo: 'inicio', nome: 'Cliente liga', x: 0, y: 0 },
    { id: 'menu', tipo: 'decisao', nome: 'Menu', x: 200, y: 0, descricao: 'Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.' },
    // A Ana Paula aparece primeiro nas peças: ela é a Pessoa 1.
    { id: 'ap', tipo: 'atendimento', nome: 'Atende a Ana Paula', x: 400, y: 100, responsavel: ANA_PAULA },
    { id: 'a', tipo: 'atendimento', nome: 'Atende a Ana', x: 400, y: 0, responsavel: ANA },
    { id: 'fila', tipo: 'atendimento', nome: 'Fila', x: 400, y: 200, responsavel: FILA },
    { id: 'f', tipo: 'fim', nome: 'Fim', x: 600, y: 0 },
  ],
  conexoes: [
    { id: 'c1', de: 'i', para: 'menu', regra: 'sempre' },
    { id: 'c2', de: 'menu', para: 'a', regra: 'opcao', valor: '2', rotulo: 'Falar com a Ana' },
    { id: 'c3', de: 'menu', para: 'ap', regra: 'condicao', valor: 'pediu a Ana Paula' },
    { id: 'c4', de: 'menu', para: 'fila', regra: 'opcao', valor: '1', rotulo: 'Análise' },
    { id: 'c5', de: 'a', para: 'f', regra: 'sempre' },
    { id: 'c6', de: 'ap', para: 'f', regra: 'sempre' },
  ],
  grupos: [{ id: 'g', nome: 'Mesa da Ana', x: 380, y: -20, w: 300, h: 300 }],
  notas: [
    { id: 'n', texto: 'A Ana sai às 17h', x: 0, y: 300, w: 100, h: 100 },
    // Quem não é responsável de nenhuma peça, citado só no texto: a Bia é cadastro da empresa; o Rui, não.
    { id: 'n2', texto: 'Se a Bia Torres faltar, chama o Rui', x: 0, y: 400, w: 100, h: 100 },
  ],
};

/** Uma chave que está no diagnóstico de DOC (a fila não tem saída): o intencional dela vai no retrato. */
const CHAVE = diagnosticar(DOC)[0]!.chave;

function link(extra: Partial<LinkDoBanco> = {}): LinkDoBanco {
  return {
    estado: 'ok',
    empresa: { nome: 'Empresa A' },
    fluxo: { nome: 'Telefonia da Ana', canal: 'telefonia', descricao: 'Quem atende é a Ana Paula', meta_s: null },
    documento: DOC,
    estilo: { velocidade: 2, cano: 'nao-existe' },
    versao: { numero: 3, nome: 'antes da Ana sair', criada_em: '2026-11-12T10:00:00Z' },
    atual: null,
    cadastros: [
      { id: ANA, tipo: 'pessoa', nome: 'Ana', campos: { ramal: '2001' } },
      { id: ANA_PAULA, tipo: 'pessoa', nome: 'Ana Paula', campos: {} },
      { id: SEM_USO, tipo: 'pessoa', nome: 'Zeca', campos: {} },
      { id: FILA, tipo: 'fila', nome: 'Fila da Ana', campos: { obs: ['falar com a Ana'] } },
    ],
    canais: [{ chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc', arquivado: false }],
    intencionais: [
      { chave: CHAVE, nota: 'a Ana pediu' },
      { chave: 'de_outra_versao:x', nota: 'não vai' },
    ],
    esconder_nomes: true,
    cenario: { nome: 'E se a Ana não atender?', inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'] },
    expira_em: null,
    // Todas as pessoas da empresa, como o abrir_link manda (por nome; Ana e Zeca também são cadastros acima).
    pessoas: ['Ana', 'Ana Paula', 'Bia Torres', 'Zeca'],
    ...extra,
  };
}

describe('nomes das pessoas', () => {
  it('cada Pessoa das peças vira "Pessoa N", na ordem em que aparece; a que nenhuma peça usa, só "Pessoa"', () => {
    expect([...pessoasEscondidas(link().cadastros, DOC)]).toEqual([
      [ANA_PAULA, 'Pessoa 1'],
      [ANA, 'Pessoa 2'],
      [SEM_USO, PESSOA],
    ]);
  });

  it('trocam como palavra inteira, sem caixa, o nome maior primeiro', () => {
    const trocar = trocadorDeNomes(new Map([['Ana', 'Pessoa 2'], ['Ana Paula', 'Pessoa 1']]));
    expect(trocar('Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.')).toBe('Digite 1 para Análise, 2 para falar com a Pessoa 2 ou 3 para a Pessoa 1.');
    expect(trocar('Banana')).toBe('Banana');
  });

  it('compara em NFC, e um acento combinante não é fim de palavra', () => {
    const trocar = trocadorDeNomes(new Map([['Ana', 'Pessoa 1'], ['José', 'Pessoa 2']]));
    expect(trocar('Fale com o José'.normalize('NFD'))).toBe('Fale com o Pessoa 2');
    expect(trocar('Rua Anã, 10'.normalize('NFD'))).toBe('Rua Anã, 10'.normalize('NFC'));
    expect(trocar('Ana̱ e ̱Ana')).toBe('Ana̱ e ̱Ana');
  });

  it('acha o nome sem depender da caixa do idioma', () => {
    expect(trocadorDeNomes(new Map([['İsmail', 'Pessoa 1']]))('Ligue para İsmail agora')).toBe('Ligue para Pessoa 1 agora');
  });

  it('espaços repetidos contam como um, NBSP é espaço e os apóstrofos são iguais', () => {
    const trocar = trocadorDeNomes(new Map([['Ana  Paula', 'Pessoa 1'], ['Ana Paula', 'Pessoa 9'], ["D'Ávila", 'Pessoa 2']]));
    expect(trocar('Ana Paula, Ana   Paula e Ana Paula')).toBe('Pessoa 1, Pessoa 1 e Pessoa 1');
    expect(trocar('Fale com d’Ávila ou D\'Ávila')).toBe('Fale com Pessoa 2 ou Pessoa 2');
  });

  it('nome de uma letra não troca nada no texto', () => {
    expect(trocadorDeNomes(new Map([['A', 'Pessoa 1']]))('Digite A para atendimento')).toBe('Digite A para atendimento');
  });

  describe('variantes do nome', () => {
    const trocar = trocadorDeNomes(new Map([['Ana Souza', 'Pessoa 1'], ['João da Silva', 'Pessoa 2']]));

    it('cada palavra do nome sozinha (3 letras ou mais, menos as partículas)', () => {
      expect(trocar('fala com a Ana')).toBe('fala com a Pessoa 1');
      expect(trocar('o Souza atende')).toBe('o Pessoa 1 atende');
      expect(trocar('ligar pro João, da Silva')).toBe('ligar pro Pessoa 2, da Pessoa 2');
      // "da" é partícula: não troca sozinha.
      expect(trocar('a casa da praia')).toBe('a casa da praia');
    });

    it('sem o acento que o nome tem', () => {
      expect(trocar('Joao da Silva ligou')).toBe('Pessoa 2 ligou');
      expect(trocar('JOAO')).toBe('Pessoa 2');
    });

    it('com hífen, sublinhado, tab, espaços ou espaço de largura zero entre as palavras', () => {
      for (const t of ['Ana-Souza', 'Ana_Souza', 'Ana\tSouza', 'ANA   SOUZA', 'Ana\u200BSouza', 'Ana\u00A0Souza'])
        expect(trocar(t), JSON.stringify(t)).toBe('Pessoa 1');
    });

    it('palavra que só contém o nome não troca', () => {
      expect(trocar('Banana e Análise')).toBe('Banana e Análise');
      expect(trocar('Anabela')).toBe('Anabela');
      // Limite conhecido: o nome grudado em outra palavra fica.
      expect(trocar('AnaSouza')).toBe('AnaSouza');
    });

    it('o nome inteiro de uma pessoa vale mais que a palavra do nome de outra', () => {
      const t = trocadorDeNomes(new Map([['Ana Paula', 'Pessoa 1'], ['Ana', 'Pessoa 2']]));
      expect(t('Ana e Paula e Ana Paula')).toBe('Pessoa 2 e Pessoa 1 e Pessoa 1');
    });
  });
});

describe('montarRetrato', () => {
  it('com nomes escondidos, nenhum nome de pessoa vai pro navegador', () => {
    const r = montarRetrato(link())!;
    const tudo = JSON.stringify(r);
    for (const nome of ['Ana', 'ANA', 'Zeca', '2001']) expect(tudo).not.toContain(nome);
    expect(r.cadastros).toEqual([
      { id: ANA, tipo: 'pessoa', nome: 'Pessoa 2', campos: {} },
      { id: ANA_PAULA, tipo: 'pessoa', nome: 'Pessoa 1', campos: {} },
      { id: SEM_USO, tipo: 'pessoa', nome: 'Pessoa', campos: {} },
      { id: FILA, tipo: 'fila', nome: 'Fila da Pessoa 2', campos: { obs: ['falar com a Pessoa 2'] } },
    ]);
  });

  it('quem não é responsável de nenhuma peça também sai do texto, sem número; a lista das pessoas não vai', () => {
    const r = montarRetrato(link())!;
    expect(r.documento.notas[1]!.texto).toBe('Se a Pessoa faltar, chama o Rui');
    const tudo = JSON.stringify(r);
    for (const nome of link().pessoas) expect(tudo).not.toContain(nome);
    expect(tudo).not.toContain('Pessoa 3');
    expect(tudo).not.toContain('pessoas');
    expect(Object.keys(r)).not.toContain('pessoas');
  });

  it('o nome que está nas peças e na lista fica com o número', () => {
    const r = montarRetrato(link({ pessoas: ['Ana Paula', 'Ana'] }))!;
    expect(r.documento.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
    // Sem a lista (resposta antiga do banco), os das peças continuam escondidos.
    expect(montarRetrato(link({ pessoas: undefined as unknown as string[] }))!.documento.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
  });

  it('o nome sai de todo texto livre; o que não é nome fica', () => {
    const { documento: d, fluxo, versao, cenario, intencionais } = montarRetrato(link())!;
    expect(d.pecas.find((p) => p.id === 'menu')!.descricao).toBe('Digite 1 para Análise, 2 para falar com a Pessoa 2 ou 3 para a Pessoa 1.');
    expect(d.pecas.map((p) => p.nome)).toEqual(['Cliente liga', 'Menu', 'Atende a Pessoa 1', 'Atende a Pessoa 2', 'Fila', 'Fim']);
    expect(d.conexoes.map((c) => [c.valor, c.rotulo])).toEqual([
      [undefined, undefined],
      ['2', 'Falar com a Pessoa 2'],
      ['pediu a Pessoa 1', undefined],
      ['1', 'Análise'],
      [undefined, undefined],
      [undefined, undefined],
    ]);
    expect(d.grupos[0]!.nome).toBe('Mesa da Pessoa 2');
    expect(d.notas[0]!.texto).toBe('A Pessoa 2 sai às 17h');
    expect(fluxo).toEqual({ nome: 'Telefonia da Pessoa 2', canal: 'telefonia', descricao: 'Quem atende é a Pessoa 1', meta_s: null });
    expect(versao).toEqual({ numero: 3, nome: 'antes da Pessoa 2 sair' });
    expect(cenario).toEqual({ nome: 'E se a Pessoa 2 não atender?', inicio: 'i', quando: '2026-11-23T10:00', modo: 'relogio', escolhas: ['c2'] });
    expect(intencionais).toEqual([{ chave: CHAVE, nota: 'a Pessoa 2 pediu' }]);
  });

  it('com nomes à mostra, fica tudo como está', () => {
    const r = montarRetrato(link({ esconder_nomes: false }))!;
    expect(r.documento).toEqual(DOC);
    expect(r.cadastros.map((k) => k.nome)).toEqual(['Ana', 'Ana Paula', 'Zeca', 'Fila da Ana']);
    expect(r.fluxo.nome).toBe('Telefonia da Ana');
    expect(r.intencionais).toEqual([{ chave: CHAVE, nota: 'a Ana pediu' }]);
  });

  it('o estilo é lido sem confiar; os canais vão só com chave, nome e cor', () => {
    const r = montarRetrato(link())!;
    expect(r.estilo).toEqual({ ...ESTILO_PADRAO, canais: {}, velocidade: 2 });
    expect(r.canais).toEqual([{ chave: 'telefonia', nome: 'Telefonia', cor: '#1e8bdc' }]);
  });

  it('versão fixa ou o fluxo de agora, com a data de cada um', () => {
    const fixa = montarRetrato(link({ esconder_nomes: false }))!;
    expect([rotuloDaVersao(fixa.versao), fixa.de]).toEqual(['versão 3 · antes da Ana sair', '2026-11-12T10:00:00Z']);
    const agora = montarRetrato(link({ versao: null, atual: { revisao: 7, editado_em: '2026-11-13T09:00:00Z' } }))!;
    expect([rotuloDaVersao(agora.versao), agora.de]).toEqual(['o fluxo de agora', '2026-11-13T09:00:00Z']);
  });

  it('do cenário guardado só vão os campos dele', () => {
    const cenario = { ...link().cenario!, esperado: { caminho: ['Ana'] } } as unknown as LinkDoBanco['cenario'];
    expect(Object.keys(montarRetrato(link({ cenario }))!.cenario!)).toEqual(['nome', 'inicio', 'quando', 'modo', 'escolhas']);
    expect(montarRetrato(link({ cenario: null }))!.cenario).toBeNull();
  });

  it('documento que não é journey/2 válido: o link não abre', () => {
    expect(montarRetrato(link({ documento: { formato: 'journey/1' } }))).toBeNull();
    expect(montarRetrato(link({ documento: { ...DOC, pecas: [{ id: 'x', tipo: 'robo' }] } }))).toBeNull();
  });

  it('o que o documento não conhece não vai', () => {
    const comLixo = { ...DOC, segredo: 'Ana', pecas: DOC.pecas.map((p) => ({ ...p, observacao: 'Ana' })) };
    expect(JSON.stringify(montarRetrato(link({ esconder_nomes: false, documento: comLixo }))!.documento)).not.toContain('observacao');
  });
});

describe('o que mais sai com os nomes escondidos', () => {
  const FULANA = 'a0000000-0000-0000-0000-00000000000f';
  const base = (doc: unknown, cadastros: LinkDoBanco['cadastros'], extra: Partial<LinkDoBanco> = {}): LinkDoBanco =>
    link({
      documento: doc,
      cadastros,
      fluxo: { nome: 'F', canal: null, descricao: '', meta_s: null },
      versao: null,
      atual: { revisao: 1, editado_em: '2026-11-13T00:00:00Z' },
      canais: [{ chave: 'wa', nome: 'WhatsApp da Ana Souza', cor: '#000000', arquivado: false }],
      intencionais: [],
      cenario: null,
      pessoas: ['Ana Souza'],
      ...extra,
    });

  it('pessoa que só aparece no texto, valor de qualquer regra, nome de canal e responsável solto', () => {
    const doc = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'a', tipo: 'atendimento', nome: 'Atende', x: 0, y: 0, responsavel: FILA, descricao: 'Se travar, chama a Ana Souza' },
        { id: 'b', tipo: 'atendimento', nome: 'Outro', x: 0, y: 0, responsavel: 'Ana Souza' },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'a', regra: 'sempre', valor: 'Ana Souza respondeu' },
        { id: 'c2', de: 'a', para: 'f', regra: 'opcao', valor: 'Ana Souza' },
        { id: 'c3', de: 'a', para: 'b', regra: 'opcao', valor: '2' },
        { id: 'c4', de: 'b', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    const r = montarRetrato(base(doc, [{ id: FILA, tipo: 'fila', nome: 'Suporte', campos: {} }]))!;
    expect(JSON.stringify(r)).not.toMatch(/Ana|Souza/);
    expect(r.documento.pecas[1]!.descricao).toBe('Se travar, chama a Pessoa');
    expect(r.documento.conexoes.map((c) => c.valor)).toEqual(['Pessoa respondeu', 'Pessoa', '2', undefined]);
    expect(r.canais[0]!.nome).toBe('WhatsApp da Pessoa');
    // O responsável que não é um dos cadastros que vieram sai; o que é fica.
    expect(r.documento.pecas.map((p) => p.responsavel)).toEqual([undefined, FILA, undefined, undefined]);
  });

  it('com os nomes à mostra, o responsável e o canal ficam como estão', () => {
    const doc = { formato: 'journey/2', pecas: [{ id: 'b', tipo: 'atendimento', nome: 'x', x: 0, y: 0, responsavel: 'Ana Souza' }], conexoes: [], grupos: [], notas: [] };
    const r = montarRetrato(base(doc, [], { esconder_nomes: false, pessoas: [] }))!;
    expect(r.documento.pecas[0]!.responsavel).toBe('Ana Souza');
    expect(r.canais[0]!.nome).toBe('WhatsApp da Ana Souza');
  });

  it('o intencional de opções repetidas com nome na condição continua no link (a chave é feita dos ids)', () => {
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'd', tipo: 'decisao', nome: 'D', x: 0, y: 0 },
        { id: 'a', tipo: 'atendimento', nome: 'A', x: 0, y: 0, responsavel: FULANA },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'd', regra: 'sempre' },
        { id: 'c2', de: 'd', para: 'a', regra: 'condicao', valor: 'pediu a Ana' },
        { id: 'c3', de: 'd', para: 'f', regra: 'condicao', valor: 'pediu a Ana' },
        { id: 'c4', de: 'a', para: 'f', regra: 'sempre' },
      ],
      grupos: [],
      notas: [],
    };
    const cadastros = [{ id: FULANA, tipo: 'pessoa', nome: 'Ana', campos: {} }];
    const chave = diagnosticar(doc, { cadastros }).find((a) => a.tipo === 'opcoes_repetidas')!.chave;
    const r = montarRetrato(base(doc, cadastros, { pessoas: ['Ana'], intencionais: [{ chave, nota: 'a Ana decide' }] }))!;
    expect(r.intencionais).toEqual([{ chave, nota: 'a Pessoa 1 decide' }]);
  });
});
