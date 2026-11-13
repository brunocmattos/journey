import Link from 'next/link';
import { Marca } from '@/componentes/Marca';
import { Nav } from '@/componentes/Nav';
import { empresa } from '@/lib/dados';

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const e = await empresa(id);
  return (
    <div className="casca cheia">
      <header className="topo">
        <Marca href={`/e/${id}`} />
        <span className="migalhas">{e.nome}</span>
        <Nav empresaId={id} />
        <div className="empurra conta">
          {/* Definir ou trocar a senha (quem entrou pelo Google ou pelo link também pode ter uma). */}
          <Link className="botao pequeno" href="/conta/senha">
            Senha
          </Link>
          <form action="/sair" method="post">
            <button className="botao pequeno">Sair</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
