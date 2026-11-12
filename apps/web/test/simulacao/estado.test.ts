import { describe, expect, it } from 'vitest';
import { doc, entrada, fila, peca, ramal, saida } from '@journey/nucleo/teste';
import { montarMapa } from '@/mapa/montar';
import { duracaoDoPasso, estadoAte } from '@/simulacao/estado';
import { passosDe } from '@/simulacao/passos';
import { canalInicial, escolher, rodar, type Sessao } from '@/simulacao/sessao';

const d = doc({
  entradas: [entrada('e', 'peca:m')],
  pecas: [peca('m', 'menu', { espera_s: 5, tentativas: 2 })],
  saidas: [saida('m', '1', 'fila:f'), saida('m', 'esgotou', 'fim:desliga')],
  filas: [fila('f')],
});
const mapa = montarMapa(d);
const s0: Sessao = { entrada: 'entrada:e', inicio: '2026-11-24T10:00', modo: 'cenario', escolhas: [] };

describe('estadoAte', () => {
  it('no fim dos passos, a decisão pendente está perguntando', () => {
    const p = passosDe(mapa, rodar(d, s0).eventos);
    const e = estadoAte(p, p.length);
    expect(e.perguntando).toMatchObject({ no: 'peca:m', quem: 'quem_liga' });
    expect([...e.molhados]).toEqual(['entrada:e>sempre']);
    expect(e.atual).toBe('peca:m');
  });

  it('no meio do caminho, o cano está enchendo e ainda não há pergunta', () => {
    const p = passosDe(mapa, rodar(d, s0).eventos);
    const i = p.findIndex((x) => x.tipo === 'correr');
    const e = estadoAte(p, i + 1);
    expect(e.correndo).toBe('entrada:e>sempre');
    expect(e.perguntando).toBeNull();
  });

  it('depois da escolha, o chip acende e o fim aparece', () => {
    const s1 = escolher(s0, rodar(d, s0).pendente!.opcoes[1]!);
    const p = passosDe(mapa, rodar(d, s1).eventos);
    const e = estadoAte(p, p.length);
    expect([...e.escolhidos]).toEqual(['peca:m>m-esgotou']);
    expect(e.fim).toMatchObject({ motivo: 'fim', ref: 'fim:desliga' });
    expect(e.t).toBe(10);
  });

  it('resposta ignorada não apaga a pergunta: a decisão continua pendente', () => {
    const e = rodar(d, { ...s0, escolhas: ['saida:m-9'] });
    expect(e.pendente).not.toBeNull();
    const p = passosDe(mapa, e.eventos);
    expect(p.slice(-2).map((x) => x.tipo)).toEqual(['decidir', 'ignorar']);
    expect(estadoAte(p, p.length).perguntando).toMatchObject({ no: 'peca:m' });
  });

  it('decisão fora do mapa também pergunta', () => {
    const dd = doc({ entradas: [entrada('e', 'peca:m'), entrada('d', 'ramal:r')], pecas: [peca('m', 'audio')], ramais: [ramal('r')] });
    const p = passosDe(montarMapa(dd), rodar(dd, { ...s0, entrada: 'entrada:d', modo: 'livre' }).eventos);
    const e = estadoAte(p, p.length);
    expect(e.fora).toBe('ramal:r');
    expect(e.perguntando).toMatchObject({ no: null, ref: 'ramal:r', quem: 'ramal' });
  });

  it('entrada de WhatsApp: o canal é WhatsApp desde a entrada', () => {
    const dw = doc({ entradas: [entrada('w', 'peca:a', { canal: 'whatsapp' })], pecas: [peca('a', 'audio', { canal: 'whatsapp' })], saidas: [saida('a', 'sempre', 'fim:atendido')] });
    const sw = { ...s0, entrada: 'entrada:w' };
    const p = passosDe(montarMapa(dw), rodar(dw, sw).eventos, canalInicial(dw, sw.entrada));
    expect(estadoAte(p, p.length).canal).toBe('whatsapp');
    const i = p.findIndex((x) => x.tipo === 'correr');
    expect(estadoAte(p, i + 1).canal).toBe('whatsapp');
  });

  it('a duração cai com a velocidade e zera sem movimento', () => {
    const p = { tipo: 'correr', cano: 'c', de: 'a', para: 'b', t: 0 } as const;
    expect(duracaoDoPasso(p, 1, false)).toBe(750);
    expect(duracaoDoPasso(p, 4, false)).toBe(187.5);
    expect(duracaoDoPasso(p, 1, true)).toBe(0);
  });
});
