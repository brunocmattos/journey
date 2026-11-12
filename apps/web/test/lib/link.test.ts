import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, ramal } from '@journey/nucleo/teste';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: async () => {} }));
// O cache do React só junta chamadas dentro de um pedido; aqui cada chamada vai pro banco.
vi.mock('react', async (original) => ({ ...(await original<typeof import('react')>()), cache: <T>(f: T) => f }));

let resposta: { data: unknown; error: { message: string } | null } = { data: null, error: null };
const chamadas: { url: string; chave: string; fn: string; args: unknown }[] = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, chave: string) => ({
    rpc: async (fn: string, args: unknown) => {
      chamadas.push({ url, chave, fn, args });
      return resposta;
    },
  }),
}));

const { abrirLink } = await import('@/lib/link');
const TOKEN = 'abcdefghijklmnopqrstuvwx';

describe('abrirLink', () => {
  beforeEach(() => {
    chamadas.length = 0;
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_teste';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  });

  it('token fora do formato nem vai pro banco', async () => {
    expect(await abrirLink('curto')).toEqual({ estado: 'inexistente' });
    expect(await abrirLink(`${TOKEN.slice(1)}/`)).toEqual({ estado: 'inexistente' });
    expect(chamadas).toEqual([]);
  });

  it('chama só abrir_link, com a chave secreta', async () => {
    resposta = { data: { estado: 'inexistente' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'inexistente' });
    expect(chamadas).toEqual([{ url: 'http://127.0.0.1:54321', chave: 'sb_secret_teste', fn: 'abrir_link', args: { p_token: TOKEN } }]);
  });

  it('revogado e vencido passam com a data', async () => {
    resposta = { data: { estado: 'revogado', quando: '2026-11-12T10:00:00Z' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'revogado', quando: '2026-11-12T10:00:00Z' });
  });

  it('vencido passa com a data', async () => {
    resposta = { data: { estado: 'vencido', quando: '2026-11-01T00:00:00Z' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'vencido', quando: '2026-11-01T00:00:00Z' });
  });

  it('erro do banco rejeita com a mensagem', async () => {
    resposta = { data: null, error: { message: 'banco fora do ar' } };
    await expect(abrirLink(TOKEN)).rejects.toThrow('banco fora do ar');
  });

  it('link que vale volta como retrato, já sem os nomes', async () => {
    const documento = doc({ ramais: [ramal('2001', { nome: 'Ana' })] });
    resposta = {
      data: {
        estado: 'ok',
        jornada: { nome: 'Telefonia', canal: 'telefonia' },
        versao: { numero: 2, criada_em: '2026-11-12T10:00:00Z', documento, diagnostico: [] },
        mais_recente: true,
        esconder_nomes: true,
        cenario: null,
        expira_em: null,
        intencionais: [],
      },
      error: null,
    };
    const r = await abrirLink(TOKEN);
    expect(r.estado).toBe('ok');
    expect(JSON.stringify(r)).not.toContain('Ana');
  });

  it('sem a chave secreta, erro claro', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(abrirLink(TOKEN)).rejects.toThrow('SUPABASE_SECRET_KEY');
  });

  it('documento que não é journey/1 não vira página', async () => {
    resposta = {
      data: { estado: 'ok', jornada: { nome: 'x', canal: 'telefonia' }, versao: { numero: 1, criada_em: '', documento: { formato: 'outro' }, diagnostico: [] }, mais_recente: true, esconder_nomes: true, cenario: null, expira_em: null, intencionais: [] },
      error: null,
    };
    await expect(abrirLink(TOKEN)).rejects.toThrow('journey/1');
  });
});
