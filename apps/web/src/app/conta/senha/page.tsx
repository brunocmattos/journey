import Link from 'next/link';
import { Marca } from '@/componentes/Marca';
import { usuarioAtual } from '@/lib/dados';
import { FormularioSenha } from './formulario';

export const metadata = { title: 'Senha · Journey' };

/**
 * Escolher (ou trocar) a senha: quem acabou de confirmar o cadastro ("Criar conta"), quem veio de "Esqueci a senha"
 * (o /auth/confirmar já gravou a sessão) e quem está logado e quer uma senha (entrou pelo Google ou pelo link). Sem
 * sessão, `usuarioAtual` manda pro entrar. A senha é opcional: "Agora não" segue pra raiz, que aceita os convites.
 */
export default async function PaginaSenha() {
  const { usuario } = await usuarioAtual();
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>Tua senha</h1>
        <p className="mudo">
          Pra entrar com o e-mail <b>{usuario.email}</b> e uma senha. Os outros jeitos de entrar continuam valendo.
        </p>
        <FormularioSenha email={usuario.email ?? ''} />
        <Link className="link-discreto" href="/">
          Agora não
        </Link>
      </div>
    </main>
  );
}
