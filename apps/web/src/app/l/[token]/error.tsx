'use client';

import { Marca } from '@/componentes/Marca';

/**
 * Quando o link não abre por falha (banco fora do ar, chave secreta faltando no servidor). Revogado, vencido e
 * inexistente não chegam aqui: a página explica cada um. Em produção o Next esconde a mensagem: só o código.
 */
export default function ErroDoLink({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = error instanceof Error && 'digest' in error ? String(error.digest) : null;
  return (
    <main className="entrar">
      <div className="cartao">
        <Marca href={null} />
        <h1>Não deu pra abrir este link agora</h1>
        <p className="mudo" style={{ margin: 0 }}>
          Tenta de novo em instantes. Se continuar, avisa quem te mandou o link.
          {codigo && <span className="mono"> (código {codigo})</span>}
        </p>
        <button className="botao primario" onClick={() => retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
