import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentoVazio, type Documento } from '@journey/fluxo';
import { ESTILO_PADRAO } from '@/editor/estilo';
import { Salvamento, copiaValida, motivoDoErro, proximaTentativa, type Resposta, type Situacao } from '@/editor/salvamento';

const doc = (n: string): Documento => ({ ...documentoVazio(), notas: [{ id: n, texto: n, x: 0, y: 0, w: 1, h: 1 }] });

function montar(respostas: Resposta[]) {
  const enviados: { revisao: number; doc: Documento }[] = [];
  const situacoes: Situacao[] = [];
  const guardados: unknown[] = [];
  let soltar: (() => void) | null = null;
  const s = new Salvamento({
    revisao: 3,
    enviar: async (revisao, documento) => {
      enviados.push({ revisao, doc: documento });
      await new Promise<void>((r) => (soltar = r));
      return respostas.shift() ?? { ok: true, revisao: revisao + 1 };
    },
    aoMudar: (x) => situacoes.push(x),
    guardar: (c) => guardados.push(c),
  });
  const responder = async () => {
    soltar?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { s, enviados, situacoes, guardados, responder };
}

describe('editor/salvamento', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('espera parar de mexer e manda só a última versão', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(300);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(499);
    expect(t.enviados).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'b']]);
    await t.responder();
    expect(t.s.revisao).toBe(4);
    expect(t.situacoes.at(-1)).toBe('salvo');
    expect(t.guardados).toEqual([null]);
  });

  it('mudou enquanto mandava: manda de novo com a revisão nova', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    expect(t.s.sujo).toBe(true);
    await t.responder();
    await vi.advanceTimersByTimeAsync(500);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(t.s.sujo).toBe(false);
  });

  it('sem rede: guarda no navegador e tenta de novo, cada vez esperando mais', async () => {
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'rede' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('sem_rede');
    expect(t.guardados.at(-1)).toMatchObject({ revisao: 3, documento: doc('a') });
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.enviados).toHaveLength(2);
    await t.responder();
    await vi.advanceTimersByTimeAsync(3999);
    expect(t.enviados).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
    expect(proximaTentativa(10)).toBe(30_000);
  });

  it('conflito ou trava perdida param tudo, com cópia no navegador', async () => {
    const t = montar([{ ok: false, motivo: 'conflito' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('conflito');
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.enviados).toHaveLength(1);
    expect(t.guardados.at(-1)).toMatchObject({ documento: doc('a') });
  });

  it('erro do banco vira motivo; cópia local só vale da mesma revisão', () => {
    expect(motivoDoErro({ code: '40001' })).toEqual({ ok: false, motivo: 'conflito' });
    expect(motivoDoErro({ code: 'P0001' })).toEqual({ ok: false, motivo: 'trava' });
    expect(motivoDoErro({ code: '', message: 'TypeError: Failed to fetch' })).toEqual({ ok: false, motivo: 'rede' });
    expect(motivoDoErro({ code: '22023', message: 'responsável' })).toEqual({ ok: false, motivo: 'recusado', mensagem: 'responsável' });
    const c = { revisao: 3, documento: doc('a'), estilo: ESTILO_PADRAO };
    expect(copiaValida(c, 3)).toBe(c);
    expect(copiaValida(c, 4)).toBeNull();
    expect(copiaValida('lixo', 3)).toBeNull();
  });
});
