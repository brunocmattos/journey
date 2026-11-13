import { describe, expect, it } from 'vitest';
import { MODELOS, type Documento } from '@journey/fluxo';
import { cenarioDoPlay, ehEsperado, paraAprovar, playDoCenario, resultado, situacao, type Cenario } from '@/editor/cenarios';
import { rodar } from '@/editor/play';

const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
const ctx = { cadastros: m.cadastros, canal: m.canal };
// Segunda às 10h: o horário comercial manda pro menu de assuntos.
const PLAY = { inicio: 'inicio', quando: '2026-11-23T10:00', modo: 'relogio' as const, escolhas: ['c6', 'c10'] };

const ESPERADO = {
  caminho: ['inicio', 'boas-vindas', 'horario', 'assunto', 'suporte', 'aguardando', 'protocolo', 'inatividade'],
  fim: { motivo: 'fim' as const, peca: 'inatividade' },
  tempo_s: 3 + 720 + 7200 + 10,
};
const cenario = (extra: Partial<Cenario> = {}): Cenario => ({
  id: 'k1',
  nome: 'Some depois do suporte',
  inicio: PLAY.inicio,
  quando: PLAY.quando,
  modo: PLAY.modo,
  escolhas: PLAY.escolhas,
  esperado: ESPERADO,
  revisao_aprovada: 4,
  atualizado_em: '2026-11-13T10:00:00Z',
  ...extra,
});

describe('editor/cenarios', () => {
  it('o resultado é o caminho das peças, como terminou e o tempo do cliente', () => {
    expect(resultado(rodar(m.documento, ctx, PLAY))).toEqual(ESPERADO);
  });

  it('play que ainda pergunta não tem fim', () => {
    const r = resultado(rodar(m.documento, ctx, { ...PLAY, escolhas: [] }));
    expect(r.fim).toBeNull();
    expect(r.caminho.at(-1)).toBe('assunto');
  });

  it('cenário e play: um vira o outro', () => {
    expect(playDoCenario(cenario())).toEqual(PLAY);
  });

  it('salvar do play: só as escolhas que o motor aceitou, e só com o play no fim', () => {
    const x = rodar(m.documento, ctx, { ...PLAY, escolhas: ['c6', 'velha', 'c10'] });
    expect(x.terminou).toBe(false);
    expect(cenarioDoPlay(PLAY, x)).toBeNull();
    const fim = rodar(m.documento, ctx, PLAY);
    expect(cenarioDoPlay({ ...PLAY, escolhas: ['c6', 'c10', 'sobrou'] }, fim)).toEqual({ ...PLAY, esperado: ESPERADO });
  });

  it('mesmo documento: igual', () => {
    expect(situacao(cenario(), m.documento, ctx)).toEqual({ situacao: 'igual', resultado: ESPERADO, escolhas: PLAY.escolhas });
  });

  it('tempo diferente no caminho: mudou, com o resultado novo', () => {
    const doc: Documento = { ...m.documento, pecas: m.documento.pecas.map((p) => (p.id === 'suporte' ? { ...p, tempo_s: 60 } : p)) };
    const s = situacao(cenario(), doc, ctx);
    expect(s.situacao).toBe('mudou');
    expect(s.resultado.tempo_s).toBe(3 + 60 + 7200 + 10);
  });

  it('a escolha guardada sumiu: mudou, mesmo que acabe igual', () => {
    // c10 trocada por outra conexão igual: o motor para na pergunta, a escolha não serve mais.
    const doc: Documento = { ...m.documento, conexoes: m.documento.conexoes.map((c) => (c.id === 'c10' ? { ...c, id: 'c10b' } : c)) };
    const s = situacao(cenario(), doc, ctx);
    expect(s.situacao).toBe('mudou');
    expect(s.resultado.fim).toBeNull();
    // Escolha a mais que o motor não usa também não é "igual": o caminho guardado não é mais o mesmo.
    expect(situacao(cenario({ escolhas: [...PLAY.escolhas, 'c99'] }), m.documento, ctx).situacao).toBe('mudou');
  });

  it('o resultado esperado é conferido como o banco confere', () => {
    expect(ehEsperado(ESPERADO)).toBe(true);
    expect(ehEsperado({ ...ESPERADO, fim: { motivo: 'beco', peca: null } })).toBe(true);
    for (const ruim of [null, [], { ...ESPERADO, fim: null }, { ...ESPERADO, fim: { motivo: 'outro', peca: 'x' } }, { ...ESPERADO, caminho: ['a', 1] }, { ...ESPERADO, tempo_s: -1 }, { ...ESPERADO, tempo_s: '3' }, { ...ESPERADO, tempo_s: Infinity }])
      expect(ehEsperado(ruim), JSON.stringify(ruim)).toBe(false);
  });

  describe('aprovar', () => {
    // Fora do horário, a espera pergunta; dentro, vai direto pro fim.
    const H = 'h0000000-0000-0000-0000-000000000001';
    const comercial = (fim: string) => ({ id: H, tipo: 'horario', nome: 'Comercial', campos: { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim }], feriados: [] } });
    const doc: Documento = {
      formato: 'journey/2',
      pecas: [
        { id: 'i', tipo: 'inicio', nome: 'Início', x: 0, y: 0 },
        { id: 'h', tipo: 'decisao', nome: 'Horário', x: 0, y: 0, responsavel: H },
        { id: 'espera', tipo: 'espera', nome: 'Espera', x: 0, y: 0 },
        { id: 'f', tipo: 'fim', nome: 'Fim', x: 0, y: 0 },
      ],
      conexoes: [
        { id: 'c1', de: 'i', para: 'h', regra: 'sempre' },
        { id: 'c2', de: 'h', para: 'f', regra: 'horario', horario: 'dentro' },
        { id: 'c3', de: 'h', para: 'espera', regra: 'senao' },
        { id: 'c5', de: 'espera', para: 'f', regra: 'opcao', valor: '1' },
        { id: 'c6', de: 'espera', para: 'f', regra: 'condicao', valor: 'desistiu' },
      ],
      grupos: [],
      notas: [],
    };

    it('a escolha que o fluxo não usa mais sai junto: depois de aprovar, igual', () => {
      // Salvo às 20h, fora do horário: a pessoa escolheu "desistiu".
      const p = { inicio: 'i', quando: '2026-11-23T20:00', modo: 'relogio' as const, escolhas: ['c6'] };
      const salvo = cenarioDoPlay(p, rodar(doc, { cadastros: [comercial('18:00')], canal: null }, p))!;
      // O horário passou a ir até as 22h: às 20h vai direto pro fim, e a escolha sobra.
      const ctx22 = { cadastros: [comercial('22:00')], canal: null };
      const s = situacao(salvo, doc, ctx22);
      expect(s).toMatchObject({ situacao: 'mudou', escolhas: [] });
      const aprovado = { ...salvo, ...paraAprovar(s)! };
      expect(aprovado.escolhas).toEqual([]);
      expect(situacao(aprovado, doc, ctx22).situacao).toBe('igual');
      // Só o resultado (sem as escolhas novas) continuaria "mudou".
      expect(situacao({ ...salvo, esperado: aprovado.esperado }, doc, ctx22).situacao).toBe('mudou');
    });

    it('sem fim não há o que aprovar', () => {
      const p = { inicio: 'i', quando: '2026-11-23T20:00', modo: 'relogio' as const, escolhas: ['c6'] };
      const ctx = { cadastros: [comercial('18:00')], canal: null };
      const salvo = cenarioDoPlay(p, rodar(doc, ctx, p))!;
      // A conexão escolhida foi refeita (outro id): o play para na pergunta.
      const semC6: Documento = { ...doc, conexoes: doc.conexoes.map((c) => (c.id === 'c6' ? { ...c, id: 'c6b' } : c)) };
      expect(paraAprovar(situacao(salvo, semC6, ctx))).toBeNull();
      // O Início sumiu: o resultado novo "termina" sem nem começar, e isso não se aprova.
      const semInicio: Documento = { ...doc, pecas: doc.pecas.filter((p) => p.id !== 'i') };
      const s = situacao(salvo, semInicio, ctx);
      expect(s.resultado.fim?.motivo).toBe('inexistente');
      expect(paraAprovar(s)).toBeNull();
    });
  });
});
