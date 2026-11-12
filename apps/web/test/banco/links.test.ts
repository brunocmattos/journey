import { beforeAll, describe, expect, it } from 'vitest';
import { doc, entrada, ramal } from '@journey/nucleo/teste';
import { montarRetrato, type LinkDoBanco } from '@/compartilhar/retrato';
import { jornadasDoImport } from '@/importacao/jornadas';
import { bancoNoAr, clienteAnonimo, clienteSecreto, usuarioNovo } from './apoio';

const noAr = await bancoNoAr();

/** Uma central mínima com o nome de uma pessoa no ramal. */
const CENTRAL = doc({ entradas: [entrada('e1', 'ramal:2001')], ramais: [ramal('2001', { nome: 'Fulana de Tal' })] });

describe.skipIf(!noAr)('links públicos no banco (Supabase local)', () => {
  let u: Awaited<ReturnType<typeof usuarioNovo>>;
  let jornada: string;
  let token: string;
  beforeAll(async () => {
    u = await usuarioNovo();
    const { data: empresa, error } = await u.cliente.rpc('criar_empresa', { p_nome: 'Links' });
    if (error) throw error;
    const jornadas = jornadasDoImport(CENTRAL);
    const { data: imp } = await u.cliente
      .from('imports')
      .insert({ empresa_id: empresa, relatorio: {}, base: CENTRAL, efetivo: CENTRAL })
      .select('id')
      .single();
    const conf = await u.cliente.rpc('confirmar_import', { p_import: imp!.id, p_jornadas: jornadas });
    if (conf.error) throw conf.error;
    jornada = (await u.cliente.from('jornadas').select('id').single()).data!.id as string;
    const l = await u.cliente.from('links').insert({ empresa_id: empresa, jornada_id: jornada }).select('token').single();
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

  it('com a chave secreta, abre a versão; o retrato sai sem o nome', async () => {
    const { data, error } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(error).toBeNull();
    const l = data as LinkDoBanco;
    expect(l).toMatchObject({ estado: 'ok', mais_recente: true, esconder_nomes: true, versao: { numero: 1 } });
    expect(JSON.stringify(l)).toContain('Fulana de Tal');
    expect(JSON.stringify(montarRetrato(l))).not.toContain('Fulana');
  });

  it('revogado, não abre mais', async () => {
    const r = await u.cliente.from('links').update({ revogado_em: new Date().toISOString() }).eq('token', token).select('id');
    expect(r.data).toHaveLength(1);
    const { data } = await clienteSecreto().rpc('abrir_link', { p_token: token });
    expect(data).toMatchObject({ estado: 'revogado' });
  });
});
