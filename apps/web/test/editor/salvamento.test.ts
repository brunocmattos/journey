import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentoVazio, type Documento } from '@journey/fluxo';
import { ESTILO_PADRAO } from '@/editor/estilo';
import { Salvamento, copiaValida, mesmoJson, motivoDoErro, proximaTentativa, type NoBanco, type Resposta, type Situacao } from '@/editor/salvamento';

const doc = (n: string): Documento => ({ ...documentoVazio(), notas: [{ id: n, texto: n, x: 0, y: 0, w: 1, h: 1 }] });

function montar(respostas: Resposta[], ler?: () => Promise<NoBanco | null>) {
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
    ...(ler && { ler }),
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
    // A cópia fica no navegador enquanto o banco não confirma, e sai quando ele confirma.
    expect(t.guardados).toEqual([{ revisao: 3, documento: doc('b'), estilo: ESTILO_PADRAO }, null]);
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

  it('recusa para e não deixa cópia (senão voltaria a cada vez que o fluxo abrisse)', async () => {
    const t = montar([{ ok: false, motivo: 'recusado', mensagem: 'responsável' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('recusado');
    expect(t.guardados.at(-1)).toBeNull();
  });

  it('envio que ficou sem resposta mas chegou: o conflito seguinte não é conflito', async () => {
    let banco: NoBanco = { revisao: 3, documento: null, estilo: null };
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'conflito' }], async () => banco);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    // O banco gravou 'a' (revisão 4), mas a resposta se perdeu; o jsonb volta com as chaves em outra ordem.
    banco = { revisao: 4, documento: Object.fromEntries(Object.entries(doc('a')).reverse()), estilo: { ...ESTILO_PADRAO } };
    await t.responder();
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    // 'b' foi com a revisão 3 e deu 40001; o banco tem a revisão 4 com 'a': segue da 4 e manda 'b' de novo.
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [3, 'b'], [4, 'b']]);
    await t.responder();
    expect(t.s.revisao).toBe(5);
    expect(t.situacoes.at(-1)).toBe('salvo');
    expect(t.situacoes).not.toContain('conflito');
  });

  it('conflito de verdade (o banco tem outra coisa) para mesmo depois de falta de rede', async () => {
    const t = montar([{ ok: false, motivo: 'rede' }, { ok: false, motivo: 'conflito' }], async () => ({ revisao: 4, documento: doc('outra'), estilo: ESTILO_PADRAO }));
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    await vi.advanceTimersByTimeAsync(2000);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('conflito');
  });

  it('envio que nunca volta: desiste no limite, com a cópia no navegador', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    expect(t.guardados.at(-1)).toMatchObject({ revisao: 3, documento: doc('a') });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(t.situacoes.at(-1)).toBe('sem_rede');
    expect(t.s.sujo).toBe(true);
  });

  it('agora espera o envio no ar e o que mudou no meio', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    let fim = false;
    void t.s.agora().then(() => (fim = true));
    await t.responder();
    expect(fim).toBe(false);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(fim).toBe(true);
    expect(t.s.sujo).toBe(false);
  });

  it('parar com envio no ar: não agenda nem muda a tela; retomar manda o que ficou', async () => {
    const t = montar([]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    t.s.parar();
    const n = t.situacoes.length;
    t.s.mudou(doc('b'), ESTILO_PADRAO);
    await t.responder();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.situacoes.length).toBe(n);
    expect(t.enviados).toHaveLength(1);
    expect(t.s.revisao).toBe(4);
    t.s.retomar();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.enviados.map((e) => [e.revisao, e.doc.notas[0]!.id])).toEqual([[3, 'a'], [4, 'b']]);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
  });

  it('sessão vencida tenta de novo, com outro aviso', async () => {
    const t = montar([{ ok: false, motivo: 'sessao' }]);
    t.s.mudou(doc('a'), ESTILO_PADRAO);
    await vi.advanceTimersByTimeAsync(500);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('sem_sessao');
    await vi.advanceTimersByTimeAsync(2000);
    await t.responder();
    expect(t.situacoes.at(-1)).toBe('salvo');
  });

  it('erro do banco vira motivo; cópia local só vale da mesma revisão', () => {
    const motivo = (...a: Parameters<typeof motivoDoErro>) => {
      const r = motivoDoErro(...a);
      return r.ok ? null : r.motivo;
    };
    expect(motivoDoErro({ code: '40001' })).toEqual({ ok: false, motivo: 'conflito' });
    expect(motivoDoErro({ code: 'P0001' })).toEqual({ ok: false, motivo: 'trava' });
    expect(motivoDoErro({ code: '', message: 'TypeError: Failed to fetch' }, 0)).toEqual({ ok: false, motivo: 'rede' });
    expect(motivoDoErro({ code: '22023', message: 'responsável' })).toEqual({ ok: false, motivo: 'recusado', mensagem: 'responsável' });
    // A mensagem não decide: código do banco com "failed" no texto continua recusa.
    expect(motivo({ code: '22023', message: 'validation failed' }, 400)).toBe('recusado');
    expect(motivo({ code: 'PGRST301' }, 401)).toBe('sessao');
    expect(motivo({ code: 'PGRST303' }, 401)).toBe('sessao');
    expect(motivo({ message: 'Invalid authentication credentials' }, 401)).toBe('sessao');
    expect(motivo({ code: '57014' }, 500)).toBe('rede');
    expect(motivo({ code: '40P01' }, 500)).toBe('rede');
    expect(motivo({ message: 'rate limit' }, 429)).toBe('rede');
    expect(motivoDoErro({ message: 'Request size limit exceeded' }, 413)).toEqual({ ok: false, motivo: 'recusado', mensagem: 'o fluxo ficou grande demais pra salvar' });
    expect(mesmoJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, d: undefined })).toBe(true);
    expect(mesmoJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(mesmoJson([1], { 0: 1 })).toBe(false);
    const c = { revisao: 3, documento: doc('a'), estilo: ESTILO_PADRAO };
    expect(copiaValida(c, 3)).toBe(c);
    expect(copiaValida(c, 4)).toBeNull();
    expect(copiaValida('lixo', 3)).toBeNull();
  });
});
