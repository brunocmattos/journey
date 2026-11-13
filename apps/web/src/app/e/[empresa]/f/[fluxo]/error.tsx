'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Quando o fluxo não abre (documento que não passa na validação, banco fora do ar…). Em produção o Next esconde a
 * mensagem do servidor: mostra só o código pra achar no log. `retry` busca a página de novo no servidor.
 */
export default function ErroDoFluxo({ error, retry }: { error: unknown; retry: () => void }) {
  const { empresa } = useParams<{ empresa: string }>();
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="pagina">
      <div className="cartao" style={{ display: 'grid', gap: 12 }}>
        <h2>Não deu pra abrir este fluxo</h2>
        <p className="aviso-caixa erro">
          Tenta de novo; se continuar, avisa quem cuida do Journey.
          {codigo && <span className="mono"> (código {codigo})</span>}
        </p>
        <div className="linha-form">
          <button className="botao primario" type="button" onClick={retry}>
            Tentar de novo
          </button>
          <Link className="botao" href={`/e/${empresa}`}>
            Voltar pros fluxos
          </Link>
        </div>
      </div>
    </main>
  );
}
