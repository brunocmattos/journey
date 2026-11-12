import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resposta = { error: { code?: string; message: string } | null };
let resposta: Resposta = { error: null };
const filtros: [string, unknown][] = [];

function consulta() {
  const q: Record<string, unknown> = {
    then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, falha),
    delete: () => q,
    eq: (coluna: string, valor: unknown) => {
      filtros.push([coluna, valor]);
      return q;
    },
  };
  return q;
}

vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: { from: consulta } }) }));
const revalidar = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (c: string) => revalidar(c) }));
const { desfazerConvite } = await import('@/acoes/membros');
const log = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('desfazerConvite', () => {
  beforeEach(() => {
    resposta = { error: null };
    filtros.length = 0;
    revalidar.mockClear();
    log.mockClear();
  });

  it('apaga o convite da empresa e atualiza a página', async () => {
    expect(await desfazerConvite('e1', 'caio@exemplo.com')).toEqual({});
    expect(filtros).toEqual([
      ['empresa_id', 'e1'],
      ['email', 'caio@exemplo.com'],
    ]);
    expect(revalidar).toHaveBeenCalledWith('/e/e1/membros');
  });

  it('erro do banco volta como mensagem amigável; o cru vai pro log', async () => {
    resposta = { error: { code: '42501', message: 'permission denied for table convites' } };
    expect(await desfazerConvite('e1', 'caio@exemplo.com')).toEqual({ erro: 'Sem acesso a esta empresa.' });
    expect(revalidar).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});
