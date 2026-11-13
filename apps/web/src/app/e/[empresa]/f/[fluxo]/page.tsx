import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { Editor } from '@/componentes/editor/Editor';
import { cadastros, canais, cenarios, fluxoParaEditar, intencionais, links, tiposCadastro, versoes } from '@/lib/dados';
import { linkPublicoConfigurado } from '@/lib/link';

type Props = { params: Promise<{ empresa: string; fluxo: string }> };

// Uma leitura por pedido: o título e a página usam o mesmo fluxo.
const fluxoDoPedido = cache(fluxoParaEditar);

/** O nome do fluxo no título da aba (no editor, ele acompanha quando renomeia). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { empresa, fluxo } = await params;
  try {
    const f = await fluxoDoPedido(empresa, fluxo);
    return { title: `${f.nome} · Journey` };
  } catch (erro) {
    // notFound e redirect (login vencido) seguem pro Next; um documento que não abre fica com o título genérico e a
    // página de erro do fluxo aparece pelo erro da própria página (aqui ele deixava a aba sem título).
    unstable_rethrow(erro);
    return { title: 'Editor · Journey' };
  }
}

export default async function PaginaEditor({ params }: Props) {
  const { empresa: empresaId, fluxo: fluxoId } = await params;
  const [f, cs, ks, ts, is, cens, vs, ls] = await Promise.all([
    fluxoDoPedido(empresaId, fluxoId),
    canais(empresaId),
    cadastros(empresaId),
    tiposCadastro(empresaId),
    intencionais(empresaId, fluxoId),
    cenarios(empresaId, fluxoId),
    versoes(empresaId, fluxoId),
    links(empresaId, fluxoId),
  ]);
  // Canal arquivado some da lista, a não ser que o fluxo ainda use (como principal ou numa peça).
  const usados = new Set([f.canal, ...f.documento.pecas.map((p) => p.canal)]);
  return (
    <Editor
      empresaId={empresaId}
      fluxo={f}
      canais={cs.filter((c) => !c.arquivado || usados.has(c.chave)).map(({ chave, nome, cor }) => ({ chave, nome, cor }))}
      cadastros={ks}
      tipos={ts}
      intencionais={is}
      cenarios={cens}
      versoes={vs}
      links={ls}
      linkConfigurado={linkPublicoConfigurado()}
    />
  );
}
