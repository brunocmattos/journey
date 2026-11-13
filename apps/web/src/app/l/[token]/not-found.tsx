import { Marca } from '@/componentes/Marca';

/** Token que não existe (ou que não tem o formato de um): explica sem dizer mais nada. */
export default function LinkInexistente() {
  return (
    <main className="entrar">
      <title>Link indisponível · Journey</title>
      <div className="cartao" data-testid="link-indisponivel">
        <Marca href={null} />
        <h1>Este link não existe</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>Confere se o endereço chegou inteiro. Se chegou, pede um link novo pra quem te mandou.</p>
      </div>
    </main>
  );
}
