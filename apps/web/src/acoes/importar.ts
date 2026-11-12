'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Documento } from '@journey/nucleo';
import { analisarArquivos } from '@/importacao/analisar';
import { jornadasDoImport } from '@/importacao/jornadas';
import { usuarioAtual } from '@/lib/dados';

const LIMITE_BYTES = 20 * 1024 * 1024;

export type EstadoImport = { erro: string } | null;

/** Recebe os arquivos, analisa e guarda o rascunho pra revisão. Um rascunho por empresa: o anterior é trocado. */
export async function analisarImport(empresaId: string, _antes: EstadoImport, form: FormData): Promise<EstadoImport> {
  const { supabase } = await usuarioAtual();
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return { erro: 'Escolhe pelo menos um arquivo (.xlsx, .csv ou .json).' };
  if (arquivos.reduce((s, f) => s + f.size, 0) > LIMITE_BYTES) return { erro: 'Os arquivos passam de 20 MB juntos.' };
  const parcial = form.get('parcial') === 'sim';

  const ultimo = await supabase
    .from('imports')
    .select('id, base')
    .eq('empresa_id', empresaId)
    .eq('status', 'confirmado')
    .order('confirmado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo.error) return { erro: ultimo.error.message };
  if (parcial && !ultimo.data) return { erro: 'Import parcial precisa de um import completo antes.' };

  const lidos = await Promise.all(arquivos.map(async (f) => ({ nome: f.name, conteudo: new Uint8Array(await f.arrayBuffer()) })));
  const a = await analisarArquivos(lidos, (ultimo.data?.base as Documento | undefined) ?? null, parcial);

  await supabase.from('imports').delete().eq('empresa_id', empresaId).eq('status', 'revisao');
  const ins = await supabase
    .from('imports')
    .insert({
      empresa_id: empresaId,
      parcial,
      anterior_id: ultimo.data?.id ?? null,
      relatorio: a.revisao,
      base: a.base,
      efetivo: a.efetivo,
      arquivos: arquivos.map((f) => ({ nome: f.name, tamanho: f.size, caminho: null })),
    })
    .select('id')
    .single();
  if (ins.error) return { erro: ins.error.message };

  // Guarda os arquivos originais (privado). Falha aqui não impede a revisão.
  const caminhos = await Promise.all(
    arquivos.map(async (f, i) => {
      const caminho = `${empresaId}/${ins.data.id}/${String(i + 1).padStart(2, '0')}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      const up = await supabase.storage.from('imports').upload(caminho, lidos[i]!.conteudo, { contentType: f.type || 'application/octet-stream' });
      return up.error ? null : caminho;
    }),
  );
  await supabase
    .from('imports')
    .update({ arquivos: arquivos.map((f, i) => ({ nome: f.name, tamanho: f.size, caminho: caminhos[i] })) })
    .eq('id', ins.data.id);

  redirect(`/e/${empresaId}/importar/${ins.data.id}`);
}

/** Confirma o rascunho: o catálogo é trocado e cada jornada ganha uma versão nova. */
export async function confirmarImport(empresaId: string, importId: string): Promise<EstadoImport> {
  const { supabase } = await usuarioAtual();
  const imp = await supabase.from('imports').select('efetivo, relatorio').eq('empresa_id', empresaId).eq('id', importId).single();
  if (imp.error) return { erro: imp.error.message };
  if (!(imp.data.relatorio as { ok: boolean }).ok) return { erro: 'O arquivo tem erros: corrige e importa de novo.' };
  const jornadas = jornadasDoImport(imp.data.efetivo as Documento);
  const r = await supabase.rpc('confirmar_import', { p_import: importId, p_jornadas: jornadas });
  if (r.error) return { erro: r.error.message };
  revalidatePath(`/e/${empresaId}`, 'layout');
  const primeira = await supabase.from('jornadas').select('id').eq('empresa_id', empresaId).eq('nome', jornadas[0]!.nome).single();
  redirect(primeira.data ? `/e/${empresaId}/j/${primeira.data.id}` : `/e/${empresaId}`);
}

export async function descartarImport(empresaId: string, importId: string): Promise<void> {
  const { supabase } = await usuarioAtual();
  await supabase.from('imports').update({ status: 'descartado' }).eq('empresa_id', empresaId).eq('id', importId).eq('status', 'revisao');
  redirect(`/e/${empresaId}/importar`);
}
