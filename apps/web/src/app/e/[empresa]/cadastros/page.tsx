import { cadastros, tiposCadastro, usosDosCadastros } from '@/lib/dados';
import { TabelaCadastros } from './tabela';

export default async function Cadastros({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const [ks, ts, usos] = await Promise.all([cadastros(id), tiposCadastro(id), usosDosCadastros(id)]);
  return <TabelaCadastros empresaId={id} cadastros={ks} tipos={ts} usos={Object.fromEntries(usos)} />;
}
