import { MODELOS } from '@journey/fluxo';
import { canais, fluxos } from '@/lib/dados';
import { ListaFluxos } from './lista';

export default async function Fluxos({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const [fs, cs] = await Promise.all([fluxos(id), canais(id)]);
  return (
    <ListaFluxos
      empresaId={id}
      fluxos={fs}
      canais={cs.map(({ chave, nome, cor, arquivado }) => ({ chave, nome, cor, arquivado }))}
      modelos={MODELOS.map((m) => ({ chave: m.chave, nome: m.nome, descricao: m.descricao, canal: m.canal, pecas: m.documento.pecas.length }))}
    />
  );
}
