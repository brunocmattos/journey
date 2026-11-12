'use client';

import { useActionState } from 'react';
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
                    <button className="botao pequeno perigo" onClick={() => desfazerConvite(empresaId, c.email)}>
                      Desfazer
                    </button>
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
