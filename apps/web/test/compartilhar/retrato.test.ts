import { describe, expect, it } from 'vitest';
import { diagnosticar } from '@journey/nucleo/diagnostico';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { esconderNomes, montarRetrato, semObservacoes, trocadorDeNomes, nomesDePessoas, type LinkDoBanco } from '@/compartilhar/retrato';
import { jornadasDoImport } from '@/importacao/jornadas';
import { central } from '../central';

const d = doc({
  entradas: [
    entrada('principal', 'peca:menu', { nome: 'Principal', observacao: 'número da fachada' }),
    entrada('direto-2001', 'ramal:2001', { nome: 'Ana direto' }),
    entrada('recepcao', 'ramal:2003', { nome: 'Recepção' }),
  ],
  ramais: [
    ramal('2001', { nome: 'Ana', ao_nao_atender: 'fila:100' }),
    ramal('2002', { nome: 'Ana Paula', tipo: 'pessoa', ao_nao_atender: 'ramal:9999', observacao: 'sai às 17h' }),
    ramal('2003', { nome: 'Recepção', tipo: 'setor' }),
  ],
  filas: [fila('100', { nome: 'Fila da Ana', espera_maxima_s: 60, ao_esgotar: 'fim:desliga', membros: ['ramal:2001', 'ramal:2002'] })],
  pecas: [peca('menu', 'menu', { nome: 'Menu principal', espera_s: 5, tentativas: 2, texto: 'Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.' })],
  saidas: [
    saida('menu', '1', 'fila:100', { rotulo: 'Análise' }),
    saida('menu', '2', 'ramal:2001', { rotulo: 'Falar com a Ana' }),
    saida('menu', '3', 'ramal:2002', { rotulo: 'Ana Paula' }),
    saida('menu', 'esgotou', 'fim:desliga'),
  ],
});

function link(extra: Partial<LinkDoBanco> = {}, documento = d): LinkDoBanco {
  return {
    estado: 'ok',
    jornada: { nome: 'Telefonia', canal: 'telefonia' },
    versao: { numero: 3, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: diagnosticar(documento) },
    mais_recente: true,
    esconder_nomes: true,
    cenario: { nome: 'E se a Ana não atender?', entrada: 'entrada:principal', inicio: '2026-11-23T10:00', modo: 'cenario', escolhas: ['saida:menu-2'] },
    expira_em: null,
    intencionais: [{ chave: 'x', nota: 'a Ana pediu' }],
    ...extra,
  };
}

describe('nomes das pessoas', () => {
  it('são os dos ramais, menos os de setor', () => {
    expect([...nomesDePessoas(d)]).toEqual([
      ['ana', 'ramal 2001'],
      ['ana paula', 'ramal 2002'],
    ]);
  });

  it('trocam como palavra inteira, sem caixa, o nome maior primeiro', () => {
    const trocar = trocadorDeNomes(nomesDePessoas(d));
    expect(trocar('Digite 1 para Análise, 2 para falar com a ANA ou 3 para a Ana Paula.')).toBe(
      'Digite 1 para Análise, 2 para falar com a ramal 2001 ou 3 para a ramal 2002.',
    );
    expect(trocar('Banana')).toBe('Banana');
  });
});

describe('esconderNomes', () => {
  const e = esconderNomes(d);

  it('o ramal perde o nome; o de setor fica', () => {
    expect(e.ramais.map((r) => r.nome)).toEqual([undefined, undefined, 'Recepção']);
  });

  it('a entrada direto num ramal escondido perde o nome; as outras trocam o nome da pessoa', () => {
    expect(e.entradas.map((x) => x.nome)).toEqual(['Principal', undefined, 'Recepção']);
    expect(e.filas[0]!.nome).toBe('Fila da ramal 2001');
  });

  it('textos dos áudios e rótulos das opções trocam o nome', () => {
    expect(e.pecas[0]!.texto).toBe('Digite 1 para Análise, 2 para falar com a ramal 2001 ou 3 para a ramal 2002.');
    expect(e.saidas.map((s) => s.rotulo)).toEqual(['Análise', 'Falar com a ramal 2001', 'ramal 2002', undefined]);
  });

  it('não mexe no resto', () => {
    expect(e.saidas.map((s) => s.para)).toEqual(d.saidas.map((s) => s.para));
    expect(e.filas[0]!.membros).toEqual(['ramal:2001', 'ramal:2002']);
    expect(d.ramais[0]!.nome).toBe('Ana');
  });
});

describe('semObservacoes', () => {
  it('tira a observação de todo item', () => {
    const s = semObservacoes(d);
    expect(JSON.stringify(s)).not.toContain('observacao');
    expect(s.entradas[0]!.nome).toBe('Principal');
  });
});

describe('montarRetrato', () => {
  it('com nomes escondidos, nenhum nome de pessoa vai pro navegador', () => {
    const r = montarRetrato(link());
    const tudo = JSON.stringify(r);
    expect(tudo).not.toMatch(/\bAna\b/i);
    expect(JSON.stringify(r.documento)).not.toContain('observacao');
    expect(r.cenario).toMatchObject({ id: 'link', nome: 'E se a ramal 2001 não atender?', escolhas: ['saida:menu-2'], versao_aprovada: 3 });
    expect(r.intencionais).toEqual([{ chave: 'x', nota: '' }]);
  });

  it('o diagnóstico tem as mesmas chaves, com os textos sem nome', () => {
    const l = link();
    const r = montarRetrato(l);
    expect(r.diagnostico.map((a) => a.chave)).toEqual(l.versao.diagnostico.map((a) => a.chave));
    expect(l.versao.diagnostico.some((a) => /Ana Paula/.test(a.titulo + a.texto))).toBe(true);
    expect(r.diagnostico.some((a) => /ramal 2002 aponta pra ramal:9999/.test(a.titulo))).toBe(true);
  });

  it('só os achados que a versão guardou', () => {
    const l = link();
    const guardado = l.versao.diagnostico.slice(1);
    const r = montarRetrato({ ...l, versao: { ...l.versao, diagnostico: guardado } });
    expect(r.diagnostico.map((a) => a.chave)).toEqual(guardado.map((a) => a.chave));
  });

  it('com nomes à mostra, mantém nomes e notas, mas não as observações', () => {
    const r = montarRetrato(link({ esconder_nomes: false, mais_recente: false, expira_em: '2026-12-12T10:00:00Z' }));
    expect(r.documento.ramais[0]!.nome).toBe('Ana');
    expect(r.cenario!.nome).toBe('E se a Ana não atender?');
    expect(r.intencionais).toEqual([{ chave: 'x', nota: 'a Ana pediu' }]);
    expect(JSON.stringify(r.documento)).not.toContain('observacao');
    expect(r).toMatchObject({ versao: 3, maisRecente: false, esconderNomes: false, expiraEm: '2026-12-12T10:00:00Z' });
  });

  it('sem cenário inicial', () => {
    expect(montarRetrato(link({ cenario: null })).cenario).toBeNull();
  });

  it('a central: nenhum "Pessoa NNN" e o mesmo diagnóstico da jornada', async () => {
    const [jornada] = jornadasDoImport(await central());
    const l = link({ cenario: null, intencionais: [] }, jornada!.documento);
    const r = montarRetrato({ ...l, versao: { ...l.versao, diagnostico: jornada!.diagnostico } });
    expect(JSON.stringify(r)).not.toMatch(/Pessoa \d/);
    expect(r.diagnostico.map((a) => a.chave)).toEqual(jornada!.diagnostico.map((a) => a.chave));
  });
});

describe('cantos do esconder nomes', () => {
  it('a entrada direto num ramal que não é setor conhecido perde o nome, mesmo sem nome no ramal ou fora do export', () => {
    const dd = doc({
      entradas: [
        entrada('e1', 'peca:menu', { nome: 'Principal' }),
        entrada('e2', 'ramal:2001', { nome: 'Carlos direto' }),
        entrada('e3', 'ramal:9999', { nome: 'Bruna direto' }),
        entrada('e4', 'ramal:2003', { nome: 'Recepção' }),
      ],
      ramais: [ramal('2001'), ramal('2003', { nome: 'Recepção', tipo: 'setor' })],
      pecas: [peca('menu', 'menu', { espera_s: 5, tentativas: 2 })],
      saidas: [saida('menu', '1', 'ramal:2003'), saida('menu', 'esgotou', 'fim:desliga')],
    });
    const l = link({}, dd);
    expect(JSON.stringify(l.versao.diagnostico)).toMatch(/Carlos|Bruna/);
    const r = montarRetrato(l);
    expect(r.documento.entradas.map((x) => x.nome)).toEqual(['Principal', undefined, undefined, 'Recepção']);
    expect(JSON.stringify(r)).not.toMatch(/Carlos|Bruna/i);
    expect(r.diagnostico.map((a) => a.chave)).toEqual(l.versao.diagnostico.map((a) => a.chave));
  });

  it('o rótulo de uma saída pra ramal sem nome ou fora do export some', () => {
    const e = esconderNomes(
      doc({
        ramais: [ramal('2001'), ramal('2002', { nome: 'Ana' }), ramal('2003', { nome: 'Recepção', tipo: 'setor' })],
        pecas: [peca('menu', 'menu', { espera_s: 5, tentativas: 2 })],
        saidas: [
          saida('menu', '1', 'ramal:9999', { rotulo: 'Bruna' }),
          saida('menu', '2', 'ramal:2001', { rotulo: 'Carlos' }),
          saida('menu', '3', 'ramal:2002', { rotulo: 'Falar com a Ana' }),
          saida('menu', '4', 'ramal:2003', { rotulo: 'Recepção' }),
          saida('menu', '5', 'fim:desliga', { rotulo: 'Sair' }),
        ],
      }),
    );
    expect(e.saidas.map((s) => s.rotulo)).toEqual([undefined, undefined, 'Falar com a ramal 2002', 'Recepção', 'Sair']);
  });

  it('compara em NFC, e um acento combinante não é fim de palavra', () => {
    const trocar = trocadorDeNomes(nomesDePessoas(doc({ ramais: [ramal('2001', { nome: 'Ana' }), ramal('2002', { nome: 'José' })] })));
    expect(trocar('Fale com o José'.normalize('NFD'))).toBe('Fale com o ramal 2002');
    expect(trocar('Rua Anã, 10'.normalize('NFD'))).toBe('Rua Anã, 10'.normalize('NFC'));
    expect(trocar('Ana̱ e ̱Ana')).toBe('Ana̱ e ̱Ana');
  });

  it('acha o nome sem depender da caixa do idioma', () => {
    const trocar = trocadorDeNomes(nomesDePessoas(doc({ ramais: [ramal('2005', { nome: 'İsmail' })] })));
    expect(trocar('Ligue para İsmail agora')).toBe('Ligue para ramal 2005 agora');
  });

  it('espaços repetidos contam como um, NBSP é espaço e os apóstrofos são iguais', () => {
    const dd = doc({
      ramais: [ramal('2002', { nome: 'Ana  Paula' }), ramal('2004', { nome: 'Ana Paula' }), ramal('2006', { nome: "D'Ávila" })],
    });
    expect([...nomesDePessoas(dd)].map(([, troca]) => troca)).toEqual(['ramal 2002', 'ramal 2006']);
    const trocar = trocadorDeNomes(nomesDePessoas(dd));
    expect(trocar('Ana Paula, Ana   Paula e Ana Paula')).toBe('ramal 2002, ramal 2002 e ramal 2002');
    expect(trocar('Fale com d’Ávila ou D\'Ávila')).toBe('Fale com ramal 2006 ou ramal 2006');
  });

  it('nome de uma letra não troca nada', () => {
    const e = esconderNomes(
      doc({
        ramais: [ramal('2001', { nome: 'A' })],
        pecas: [peca('menu', 'menu', { texto: 'Digite A para atendimento' })],
      }),
    );
    expect(e.pecas[0]!.texto).toBe('Digite A para atendimento');
    expect(e.ramais[0]!.nome).toBeUndefined();
  });
});
