import type { Metadata } from 'next';
import { Editor } from '@/componentes/editor/Editor';
import { cadastros, canais, fluxoParaEditar, tiposCadastro } from '@/lib/dados';

export const metadata: Metadata = { title: 'Editor · Journey' };

export default async function PaginaEditor({ params }: { params: Promise<{ empresa: string; fluxo: string }> }) {
  const { empresa: empresaId, fluxo: fluxoId } = await params;
  const [f, cs, ks, ts] = await Promise.all([fluxoParaEditar(empresaId, fluxoId), canais(empresaId), cadastros(empresaId), tiposCadastro(empresaId)]);
  // Canal arquivado some da lista, a não ser que o fluxo ainda use (como principal ou numa peça).
  const usados = new Set([f.canal, ...f.documento.pecas.map((p) => p.canal)]);
  return (
    <Editor
      empresaId={empresaId}
      fluxo={f}
      canais={cs.filter((c) => !c.arquivado || usados.has(c.chave)).map(({ chave, nome, cor }) => ({ chave, nome, cor }))}
      cadastros={ks}
      tipos={ts}
    />
  );
}
