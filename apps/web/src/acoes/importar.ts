'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Documento } from '@journey/nucleo';
import { analisarArquivos } from '@/importacao/analisar';
import { jornadasDoImport } from '@/importacao/jornadas';
import { ERRO_LIMITE, passaDoLimite } from '@/importacao/limite';
import { usuarioAtual } from '@/lib/dados';
import { mensagemDoErro } from '@/lib/erros';

export type EstadoImport = { erro: string } | null;

const NAO_EM_REVISAO = 'Este import não está mais em revisão (outro import o substituiu).';

/** Recebe os arquivos, analisa e guarda o rascunho pra revisão. Um rascunho por empresa: o anterior é trocado. */
export async function analisarImport(empresaId: string, _antes: EstadoImport, form: FormData): Promise<EstadoImport> {
  const { supabase } = await usuarioAtual();
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0) return { erro: 'Escolhe pelo menos um arquivo (.xlsx, .csv ou .json).' };
  if (passaDoLimite(arquivos.map((f) => f.size))) return { erro: ERRO_LIMITE };
  const parcial = form.get('parcial') === 'sim';

  const ultimo = await supabase
    .from('imports')
    .select('id, base')
    .eq('empresa_id', empresaId)
    .eq('status', 'confirmado')
    .order('confirmado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo.error) return { erro: mensagemDoErro('analisarImport: último import', ultimo.error) };
  if (parcial && !ultimo.data) return { erro: 'Import parcial precisa de um import completo antes.' };

  const lidos = await Promise.all(arquivos.map(async (f) => ({ nome: f.name, conteudo: new Uint8Array(await f.arrayBuffer()) })));
  const a = await analisarArquivos(lidos, (ultimo.data?.base as Documento | undefined) ?? null, parcial);

  const apagado = await supabase.from('imports').delete().eq('empresa_id', empresaId).eq('status', 'revisao');
  if (apagado.error) console.error('[analisarImport: apagar rascunho anterior]', apagado.error.code, apagado.error.message);
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
  // 23505: outra pessoa analisou um import ao mesmo tempo (um rascunho por empresa).
  if (ins.error)
    return { erro: mensagemDoErro('analisarImport: gravar rascunho', ins.error, { '23505': 'Outro import está em revisão nesta empresa; abre ele ou descarta antes.' }) };

  // Guarda os arquivos originais (privado). Falha aqui não impede a revisão.
  const caminhos = await Promise.all(
    arquivos.map(async (f, i) => {
      const caminho = `${empresaId}/${ins.data.id}/${String(i + 1).padStart(2, '0')}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      // Sempre octet-stream (o bucket só aceita esse): o arquivo nunca volta como página que o navegador roda.
      const up = await supabase.storage.from('imports').upload(caminho, lidos[i]!.conteudo, { contentType: 'application/octet-stream' });
      if (up.error) console.error('[analisarImport: guardar arquivo]', caminho, up.error.message);
      return up.error ? null : caminho;
    }),
  );
  const anotado = await supabase
    .from('imports')
    .update({ arquivos: arquivos.map((f, i) => ({ nome: f.name, tamanho: f.size, caminho: caminhos[i] })) })
    .eq('id', ins.data.id);
  if (anotado.error) console.error('[analisarImport: anotar arquivos]', anotado.error.code, anotado.error.message);

  redirect(`/e/${empresaId}/importar/${ins.data.id}`);
}

/** Confirma o rascunho: o catálogo é trocado e cada jornada ganha uma versão nova. */
export async function confirmarImport(empresaId: string, importId: string): Promise<EstadoImport> {
  const { supabase } = await usuarioAtual();
  const imp = await supabase.from('imports').select('efetivo, relatorio').eq('empresa_id', empresaId).eq('id', importId).maybeSingle();
  if (imp.error) return { erro: mensagemDoErro('confirmarImport: ler import', imp.error) };
  // Analisar um import novo apaga o rascunho anterior: quem estava revisando ele chega aqui.
  if (!imp.data) return { erro: NAO_EM_REVISAO };
  if (!(imp.data.relatorio as { ok: boolean }).ok) return { erro: 'O arquivo tem erros: corrige e importa de novo.' };
  const jornadas = jornadasDoImport(imp.data.efetivo as Documento);
  const r = await supabase.rpc('confirmar_import', { p_import: importId, p_jornadas: jornadas });
  if (r.error) {
    // P0001 "este import já foi …" e P0002 "não encontrado": o rascunho saiu de revisão. P0001 "outro import foi confirmado": base velha.
    const saiu = r.error.code === 'P0002' || (r.error.code === 'P0001' && r.error.message.startsWith('este import já foi'));
    const msg = saiu ? NAO_EM_REVISAO : 'Outro import foi confirmado depois desta análise: importa de novo.';
    return { erro: mensagemDoErro('confirmarImport', r.error, { P0001: msg, P0002: msg }) };
  }
  revalidatePath(`/e/${empresaId}`, 'layout');
  const primeira = await supabase.from('jornadas').select('id').eq('empresa_id', empresaId).eq('nome', jornadas[0]!.nome).single();
  redirect(primeira.data ? `/e/${empresaId}/j/${primeira.data.id}` : `/e/${empresaId}`);
}

export async function descartarImport(empresaId: string, importId: string): Promise<EstadoImport> {
  const { supabase } = await usuarioAtual();
  const r = await supabase.from('imports').update({ status: 'descartado' }).eq('empresa_id', empresaId).eq('id', importId).eq('status', 'revisao');
  // Sem isto, a pessoa voltaria pra lista achando que descartou.
  if (r.error) return { erro: mensagemDoErro('descartarImport', r.error) };
  redirect(`/e/${empresaId}/importar`);
}
