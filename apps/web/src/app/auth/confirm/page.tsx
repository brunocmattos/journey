import { redirect } from 'next/navigation';
import { Marca } from '@/componentes/Marca';
import { caminhoInterno, tipoDoEmail } from '@/lib/acesso';

export const metadata = { title: 'Entrar · Journey', robots: { index: false, follow: false } };

/**
 * Onde chegam os links dos e-mails do login (modelos em supabase/templates). Abrir o link só mostra esta página: quem
 * confirma é o botão, num POST pro /auth/confirmar. Assim um link aberto sozinho não gasta o token (o leitor de links
 * do provedor de e-mail abre tudo o que chega) nem põe ninguém na conta de outra pessoa (um link com o token de alguém,
 * aberto sem querer, entraria na conta dele).
 */
export default async function ConfirmarEmail({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const p = await searchParams;
  const tipo = tipoDoEmail(p.type ?? null);
  if (!p.token_hash || !tipo) redirect('/entrar?erro=link');
  const recuperacao = tipo === 'recovery';
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca />
        <h1>{recuperacao ? 'Trocar a senha' : 'Entrar no Journey'}</h1>
        <p className="mudo">{recuperacao ? 'Falta um passo: continua pra escolher a senha nova.' : 'Falta um passo: confirma pra entrar com este e-mail.'}</p>
        {/* Formulário comum, sem JavaScript: funciona antes de a página ficar pronta. */}
        <form method="post" action="/auth/confirmar" style={{ display: 'grid' }}>
          <input type="hidden" name="token_hash" value={p.token_hash} />
          <input type="hidden" name="type" value={tipo} />
          <input type="hidden" name="next" value={caminhoInterno(p.next)} />
          <button className="botao primario" type="submit">
            {recuperacao ? 'Continuar pra trocar a senha' : 'Confirmar e entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
