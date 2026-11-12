import { beforeAll, describe, expect, it } from 'vitest';
import { importar } from '@journey/nucleo';
import { jornadasDoImport } from '@/importacao/jornadas';
import { revisar } from '@/importacao/revisao';
import { arquivosDaCentral } from '../central';
import { bancoNoAr, usuarioNovo } from './apoio';

const noAr = await bancoNoAr();

describe.skipIf(!noAr)('import no banco (Supabase local)', () => {
  let empresa: string;
  let u: Awaited<ReturnType<typeof usuarioNovo>>;
  beforeAll(async () => {
    u = await usuarioNovo();
    const { data, error } = await u.cliente.rpc('criar_empresa', { p_nome: 'Teste' });
    if (error) throw error;
    empresa = data as string;
  });

  it('a central inteira entra, vira catálogo e uma versão da jornada', async () => {
    const r = await importar(await arquivosDaCentral());
    const jornadas = jornadasDoImport(r.efetivo);
    const { data: imp, error } = await u.cliente
      .from('imports')
      .insert({ empresa_id: empresa, relatorio: revisar(r, jornadas, false), base: r.base, efetivo: r.efetivo })
      .select('id')
      .single();
    expect(error).toBeNull();
    const conf = await u.cliente.rpc('confirmar_import', { p_import: imp!.id, p_jornadas: jornadas });
    expect(conf.error).toBeNull();
    const { count } = await u.cliente.from('catalogo').select('*', { count: 'exact', head: true }).eq('aba', 'ramais');
    expect(count).toBe(r.efetivo.ramais.length);
    const { data: v } = await u.cliente.from('jornada_versoes').select('numero, documento, diagnostico').single();
    expect(v!.numero).toBe(1);
    expect(v!.documento).toEqual(r.efetivo);
    expect((v!.diagnostico as unknown[]).length).toBe(jornadas[0]!.diagnostico.length);
  });
});
