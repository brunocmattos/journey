import Link from 'next/link';
import { jornadas } from '@/lib/dados';
import { FUSO } from '@/lib/fuso';

export default async function Jornadas({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const js = await jornadas(id);
  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Jornadas</h1>
        <Link className="botao primario" href={`/e/${id}/importar`}>
          Importar a central
        </Link>
      </div>
      {js.length === 0 ? (
        <div className="cartao">
          <h2>Nada importado ainda</h2>
          <p className="mudo">
            Baixa o modelo na tela de import, preenche com o fluxo da tua central (ou exporta pelo roteiro de extração) e importa. A primeira importação cria uma jornada por canal das entradas.
          </p>
        </div>
      ) : (
        <div className="grade">
          {js.map((j) => (
            <Link key={j.id} href={`/e/${id}/j/${j.id}`} className="cartao" style={{ textDecoration: 'none', display: 'grid', gap: 6 }}>
              <span className="nav" style={{ justifySelf: 'start', border: 0, padding: 0, background: 'none' }}>
                <span className="ponto" style={{ ['--c' as string]: `var(--w-${j.canal})`, width: 10, height: 10, borderRadius: '50%', background: 'var(--c)' }} />
              </span>
              <h2>{j.nome}</h2>
              <span className="mudo">
                versão {j.versao ?? '—'}
                {j.atualizada && ` · ${new Date(j.atualizada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO })}`}
              </span>
              {j.graves > 0 ? <span className="selo grave">{j.graves} graves</span> : <span className="selo ok">sem achado grave</span>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
