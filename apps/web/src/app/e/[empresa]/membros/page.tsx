import { membros } from '@/lib/dados';
import { Convites } from './convites';

export default async function Membros({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const m = await membros(id);
  return (
    <main className="pagina">
      <h1>Membros</h1>
      <div className="cartao">
        <h2>Quem edita</h2>
        <table className="tabela">
          <tbody>
            {m.membros.map((x) => (
              <tr key={x.usuario_id}>
                <td>{x.email}</td>
                <td className="mudo">desde {new Date(x.entrou_em).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Convites empresaId={id} convites={m.convites} />
    </main>
  );
}
