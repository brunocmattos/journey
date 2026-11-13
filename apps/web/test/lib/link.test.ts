import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkDoBanco } from '@/compartilhar/retrato';

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

const { abrirLink, linkPublicoConfigurado } = await import('@/lib/link');
const TOKEN = 'abcdefghijklmnopqrstuvwx';
const ANA = 'a0000000-0000-0000-0000-000000000001';

const ok = (extra: Partial<LinkDoBanco> = {}): LinkDoBanco => ({
  estado: 'ok',
  empresa: { nome: 'Empresa A' },
  fluxo: { nome: 'Cobrança', canal: 'whatsapp', descricao: '', meta_s: null },
  documento: {
    formato: 'journey/2',
    pecas: [
      { id: 'i', tipo: 'inicio', nome: 'Começo', x: 0, y: 0 },
      { id: 'a', tipo: 'atendimento', nome: 'Atende a Ana', x: 200, y: 0, responsavel: ANA },
    ],
    conexoes: [{ id: 'c', de: 'i', para: 'a', regra: 'sempre' }],
    grupos: [],
    notas: [],
  },
  estilo: {},
  versao: null,
  atual: { revisao: 2, editado_em: '2026-11-13T10:00:00Z' },
  cadastros: [{ id: ANA, tipo: 'pessoa', nome: 'Ana', campos: {} }],
  canais: [],
  intencionais: [],
  esconder_nomes: true,
  cenario: null,
  expira_em: null,
  pessoas: ['Ana', 'Bia'],
  ...extra,
});

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
    resposta = { data: { estado: 'vencido', quando: '2026-11-01T00:00:00Z' }, error: null };
    expect(await abrirLink(TOKEN)).toEqual({ estado: 'vencido', quando: '2026-11-01T00:00:00Z' });
  });

  it('erro do banco rejeita com a mensagem', async () => {
    resposta = { data: null, error: { message: 'banco fora do ar' } };
    await expect(abrirLink(TOKEN)).rejects.toThrow('banco fora do ar');
  });

  it('link que vale volta como retrato, já sem os nomes', async () => {
    resposta = { data: ok(), error: null };
    const r = await abrirLink(TOKEN);
    expect(r.estado).toBe('ok');
    expect(JSON.stringify(r)).not.toContain('Ana');
  });

  it('sem a chave secreta, erro claro', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(abrirLink(TOKEN)).rejects.toThrow('SUPABASE_SECRET_KEY');
  });

  it('documento que não é journey/2 válido não vira página', async () => {
    resposta = { data: ok({ documento: { formato: 'journey/1' } }), error: null };
    await expect(abrirLink(TOKEN)).rejects.toThrow('este link não abre');
  });
});

describe('linkPublicoConfigurado', () => {
  it('diz se o servidor tem a chave secreta', () => {
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_teste';
    expect(linkPublicoConfigurado()).toBe(true);
    process.env.SUPABASE_SECRET_KEY = '';
    expect(linkPublicoConfigurado()).toBe(false);
    delete process.env.SUPABASE_SECRET_KEY;
    expect(linkPublicoConfigurado()).toBe(false);
  });
});
