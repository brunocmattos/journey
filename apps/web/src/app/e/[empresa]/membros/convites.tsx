'use client';

import { useActionState, useState, useTransition } from 'react';
import { convidar, desfazerConvite } from '@/acoes/membros';

export function Convites({ empresaId, convites }: { empresaId: string; convites: { email: string; criado_em: string }[] }) {
  const [estado, acao, pendente] = useActionState(convidar.bind(null, empresaId), null);
  return (
    <div className="cartao" style={{ display: 'grid', gap: 10 }}>
      <h2>Convidar</h2>
      <p className="mudo">A pessoa entra pelo link mágico com este e-mail e já cai na empresa. Não sai e-mail de convite: avisa tu.</p>
      <form action={acao} className="linha-form">
        <label className="campo" style={{ flex: '1 1 240px' }}>
          E-mail
          <input name="email" type="email" required />
        </label>
        <button className="botao primario" disabled={pendente}>
          Convidar
        </button>
      </form>
      {estado?.erro && <p className="aviso-caixa erro">{estado.erro}</p>}
      {estado?.ok && <p className="aviso-caixa ok">{estado.ok}</p>}
      {convites.length > 0 && (
        <>
          <div className="rotulo-secao">Convites esperando</div>
          <table className="tabela">
            <tbody>
              {convites.map((c) => (
                <tr key={c.email}>
                  <td>{c.email}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Desfazer empresaId={empresaId} email={c.email} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Desfaz um convite: o botão fica "Desfazendo…" enquanto vai e mostra o erro, se der. */
function Desfazer({ empresaId, email }: { empresaId: string; email: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      {erro && (
        <span role="alert" style={{ color: 'var(--bad)', fontSize: 13, marginRight: 8 }}>
          {erro}
        </span>
      )}
      <button
        className="botao pequeno perigo"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await desfazerConvite(empresaId, email);
            if (r.erro) setErro(r.erro);
          })
        }
      >
        {pendente ? 'Desfazendo…' : 'Desfazer'}
      </button>
    </>
  );
}
