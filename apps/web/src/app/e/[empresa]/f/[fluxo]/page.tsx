import type { Metadata } from 'next';
import { cache } from 'react';
import { Editor } from '@/componentes/editor/Editor';
import { cadastros, canais, fluxoParaEditar, tiposCadastro } from '@/lib/dados';

type Props = { params: Promise<{ empresa: string; fluxo: string }> };

// Uma leitura por pedido: o título e a página usam o mesmo fluxo.
const fluxoDoPedido = cache(fluxoParaEditar);

/** O nome do fluxo no título da aba (no editor, ele acompanha quando renomeia). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { empresa, fluxo } = await params;
  const f = await fluxoDoPedido(empresa, fluxo);
  return { title: `${f.nome} · Journey` };
}

export default async function PaginaEditor({ params }: Props) {
  const { empresa: empresaId, fluxo: fluxoId } = await params;
  const [f, cs, ks, ts] = await Promise.all([fluxoDoPedido(empresaId, fluxoId), canais(empresaId), cadastros(empresaId), tiposCadastro(empresaId)]);
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
