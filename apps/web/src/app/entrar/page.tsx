import { Marca } from '@/componentes/Marca';
import { FormularioEntrar } from './formulario';

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <p className="mudo">O fluxo de atendimento como um encanamento: dá play numa entrada e vê pra onde a ligação vai.</p>
        {erro === 'link' && <p className="aviso-caixa erro">O link expirou ou já foi usado. Pede outro.</p>}
        <FormularioEntrar google={process.env.NEXT_PUBLIC_LOGIN_GOOGLE === 'sim'} />
      </div>
    </main>
  );
}
