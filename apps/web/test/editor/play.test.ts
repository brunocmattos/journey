import { describe, expect, it } from 'vitest';
import { MODELOS, type Opcao } from '@journey/fluxo';
import { agora, duracaoCano, espera, opcaoDaTecla, rodar, visual, voltar } from '@/editor/play';

const m = MODELOS.find((x) => x.chave === 'whatsapp')!;
const ctx = { cadastros: m.cadastros, canal: m.canal };
const PLAY = { inicio: 'inicio', quando: '2026-11-23T10:00', modo: 'relogio' as const, escolhas: [] as string[] };

describe('editor/play', () => {
  it('mostra os eventos aos poucos: água correndo, peças molhadas, a pergunta', () => {
    const x = rodar(m.documento, ctx, PLAY);
    const correu = x.eventos.findIndex((e) => e.tipo === 'correu');
    const v1 = visual(x.eventos, correu + 1);
    expect(v1.correndo).toEqual({ conexao: 'c1', canal: 'whatsapp' });
    expect([...v1.molhadas.keys()]).toEqual(['inicio']);
    const v2 = visual(x.eventos, x.eventos.length);
    expect(v2.correndo).toBeNull();
    expect(v2.cheias.get('c1')).toBe('whatsapp');
    expect(v2.pergunta?.peca).toBe('assunto');
    expect(v2.atual).toBe('assunto');
    expect(v2.linha.map((l) => l.peca)).toEqual(['inicio', 'boas-vindas', 'horario', 'assunto']);
    expect(v2.relogio_s).toBe(3);
  });

  it('escolher e voltar refazem pelo motor; o canal muda a cor da água', () => {
    const p = { ...PLAY, escolhas: ['c6', 'c10'] };
    const x = rodar(m.documento, ctx, p);
    const v = visual(x.eventos, x.eventos.length);
    expect(v.fim).toEqual({ motivo: 'fim', peca: 'inatividade' });
    expect(v.molhadas.get('protocolo')).toBe('email');
    expect(v.cheias.get('c11')).toBe('email');
    expect(v.relogio_s).toBe(3 + 720 + 7200 + 10);
    const antes = rodar(m.documento, ctx, voltar(p));
    expect(visual(antes.eventos, antes.eventos.length).pergunta?.peca).toBe('aguardando');
  });

  it('espera de cada evento e duração do cano', () => {
    expect(espera({ tipo: 'chegou', peca: 'a', canal: null, relogio_s: 0 })).toBe(520);
    expect(espera({ tipo: 'escolheu', peca: 'a', conexao: 'c', quem: 'unica' })).toBe(0);
    expect(espera({ tipo: 'terminou', motivo: 'fim', peca: 'a', relogio_s: 0 })).toBe(0);
    expect(espera({ tipo: 'correu', conexao: 'c', de: 'a', para: 'b', relogio_s: 0 })).toBe('cano');
    expect(duracaoCano(100, 1)).toBe(380);
    expect(duracaoCano(500, 2)).toBe(600);
  });

  it('tecla: o código de uma letra da opção, ou a posição', () => {
    const ops = [{ conexao: 'c8' }, { conexao: 'c9' }] as Opcao[];
    const valores = new Map([['c8', 'S'], ['c9', 'N']]);
    expect(opcaoDaTecla(ops, 'n', valores)?.conexao).toBe('c9');
    expect(opcaoDaTecla(ops, '1', valores)?.conexao).toBe('c8');
    expect(opcaoDaTecla(ops, '3', valores)).toBeNull();
    expect(opcaoDaTecla(ops, 'x', valores)).toBeNull();
  });

  it('agora em São Paulo, no formato do motor', () => {
    expect(agora(new Date('2026-11-23T13:05:00Z'))).toBe('2026-11-23T10:05');
  });
});
