'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Quando a jornada não abre (versão com documento que não é journey/1, banco fora do ar…).
 * Em produção o Next esconde a mensagem do servidor: mostra só o código pra achar no log.
 * `retry` busca a página de novo no servidor; `reset` só redesenharia o mesmo erro.
 */
export default function ErroDaJornada({ error, retry }: { error: unknown; retry: () => void }) {
  const { empresa } = useParams<{ empresa: string }>();
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="pagina">
      <div className="cartao" style={{ display: 'grid', gap: 12 }}>
        <h2>Não deu pra abrir esta jornada</h2>
        <p className="aviso-caixa erro">
          A versão guardada não pôde ser lida. Tenta de novo; se continuar, importa a central outra vez.
          {codigo && <span className="mono"> (código {codigo})</span>}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="botao primario" onClick={() => retry()}>
            Tentar de novo
          </button>
          <Link className="botao" href={`/e/${empresa}`}>
            Voltar pras jornadas
          </Link>
        </div>
      </div>
    </main>
  );
}
