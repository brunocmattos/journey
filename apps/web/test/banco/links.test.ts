import { beforeAll, describe, expect, it } from 'vitest';
import { bancoNoAr, clienteAnonimo, clienteSecreto, usuarioNovo } from './apoio';

const noAr = await bancoNoAr();

// O pgTAP (compartilhar.test.sql) confere o abrir_link por dentro; aqui, o caminho de verdade: a API do Supabase.
describe.skipIf(!noAr)('links públicos no banco (Supabase local)', () => {
  let u: Awaited<ReturnType<typeof usuarioNovo>>;
  let token: string;
  beforeAll(async () => {
    u = await usuarioNovo();
    const { data: empresa, error } = await u.cliente.rpc('criar_empresa', { p_nome: 'Links' });
    if (error) throw error;
    const f = await u.cliente.from('fluxos').insert({ empresa_id: empresa, nome: 'Cobrança', canal: 'whatsapp' }).select('id').single();
    if (f.error) throw f.error;
    const l = await u.cliente.from('links').insert({ empresa_id: empresa, fluxo_id: f.data.id }).select('token').single();
    if (l.error) throw l.error;
    token = l.data.token as string;
  });

  it('o membro cria o link e o banco dá o token', () => {
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('sem conta, a API não lê os links nem chama abrir_link', async () => {
    const anonimo = clienteAnonimo();
    const { data } = await anonimo.from('links').select('token');
    expect(data ?? []).toEqual([]);
    const r = await anonimo.rpc('abrir_link', { p_token: token });
    expect(r.error?.code).toBe('42501');
  });

  it('nem o membro logado chama abrir_link', async () => {
    const r = await u.cliente.rpc('abrir_link', { p_token: token });
    expect(r.error?.code).toBe('42501');
  });

  it('com a chave secreta, abre o fluxo de agora', async () => {
    const { data, error } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(error).toBeNull();
    expect(data).toMatchObject({ estado: 'ok', empresa: { nome: 'Links' }, fluxo: { nome: 'Cobrança', canal: 'whatsapp' }, versao: null, atual: { revisao: 0 } });
  });

  it('revogado, não abre mais', async () => {
    const r = await u.cliente.from('links').update({ revogado_em: new Date().toISOString() }).eq('token', token).select('id');
    expect(r.data).toHaveLength(1);
    const { data } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(data).toMatchObject({ estado: 'revogado' });
  });
});
