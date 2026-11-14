import './entrar.css';
import { Marca } from '@/componentes/Marca';
import { avisoDaVolta, jeitosDeEntrar, modoDoEntrar } from '@/lib/acesso';
import { FormularioEntrar } from './formulario';
import { PreviaFluxo } from './previa';

export const metadata = { title: 'Entrar · Journey' };

/**
 * Entrar: de um lado o que o Journey é e o formulário (e-mail e senha, criar conta, o link por e-mail e o Google se
 * estiver ligado; ou só o Google, com o e-mail desligado), do outro uma prévia do quadro com a água andando. A página é leve: nada do editor nem do pacote do fluxo.
 */
export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; modo?: string }> }) {
  const { erro, modo } = await searchParams;
  const jeitos = jeitosDeEntrar(process.env.NEXT_PUBLIC_LOGIN_GOOGLE, process.env.NEXT_PUBLIC_LOGIN_EMAIL);
  return (
    <main className="entrada">
      <div className="lado-form">
        <Marca href={null} />
        <div className="chamada">
          <h1>Desenha o fluxo e dá play.</h1>
          <p className="lead">
            Um quadro pro atendimento de qualquer canal: telefonia, WhatsApp, e-mail, chat ou uma esteira interna. No play, a água anda pelos canos, muda de cor
            quando o canal muda, para nas decisões e mostra quanto tempo o cliente levou.
          </p>
        </div>
        {/* O aviso do link vencido (ou do Google cancelado) fica no formulário: some quando a pessoa tenta de novo. */}
        <FormularioEntrar google={jeitos.google} email={jeitos.email} aviso={avisoDaVolta(erro, jeitos)} modo={modoDoEntrar(modo)} />
      </div>
      <PreviaFluxo />
    </main>
  );
}
