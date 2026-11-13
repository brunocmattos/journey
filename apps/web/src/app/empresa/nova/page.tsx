import Link from 'next/link';
import { Marca } from '@/componentes/Marca';
import { jeitosDeEntrar } from '@/lib/acesso';
import { FormularioEmpresa } from './formulario';

export default function NovaEmpresa() {
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>Tua empresa</h1>
        <p className="mudo">É o espaço onde ficam os fluxos, os cadastros e quem pode editar. Depois tu convida os colegas.</p>
        <FormularioEmpresa />
        {/* Quem ainda não tem empresa também escolhe a senha (com o e-mail ligado) e sai daqui (o topo da empresa só existe depois). */}
        <div className="conta-rodape">
          {jeitosDeEntrar(process.env.NEXT_PUBLIC_LOGIN_GOOGLE, process.env.NEXT_PUBLIC_LOGIN_EMAIL).email && (
            <Link className="botao pequeno" href="/conta/senha">
              Senha
            </Link>
          )}
          <form action="/sair" method="post">
            <button className="botao pequeno">Sair</button>
          </form>
        </div>
      </div>
    </main>
  );
}
