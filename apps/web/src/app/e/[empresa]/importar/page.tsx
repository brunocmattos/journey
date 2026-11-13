import Link from 'next/link';
import { importsRecentes } from '@/lib/dados';
import { FormularioImport } from './formulario';
import { FUSO } from '@/lib/fuso';

const STATUS = { revisao: 'em revisão', confirmado: 'confirmado', descartado: 'descartado' } as const;

export default async function Importar({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const recentes = await importsRecentes(id);
  const emRevisao = recentes.find((i) => i.status === 'revisao');
  return (
    <main className="pagina">
      <h1>Importar</h1>
      <div className="cartao" style={{ display: 'grid', gap: 12 }}>
        <h2>Arquivos da central</h2>
        <p className="mudo">
          Uma planilha <span className="mono">.xlsx</span> com as abas do modelo, um <span className="mono">.csv</span> por aba (o nome do arquivo é o nome da aba) ou um{' '}
          <span className="mono">.json</span> no formato <span className="mono">journey/1</span>. Nada muda até tu confirmar na revisão.
        </p>
        <div className="linha-form">
          <a className="botao" href="/modelos/modelo-journey.xlsx">
            Baixar modelo (.xlsx)
          </a>
          <a className="botao" href="/modelos/modelo-journey.json">
            Baixar modelo (.json)
          </a>
          <a className="botao" href="/modelos/esquema-journey.json">
            Esquema JSON
          </a>
        </div>
        <FormularioImport empresaId={id} />
      </div>
      {emRevisao && (
        <p className="aviso-caixa info">
          Tem um import esperando revisão. <Link href={`/e/${id}/importar/${emRevisao.id}`}>Abrir a revisão</Link>
        </p>
      )}
      {recentes.length > 0 && (
        <div className="cartao">
          <h2>Últimos imports</h2>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Arquivos</th>
                  <th>Tipo</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/e/${id}/importar/${i.id}`}>{new Date(i.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO })}</Link>
                    </td>
                    <td>{i.arquivos.map((a) => a.nome).join(', ')}</td>
                    <td>{i.parcial ? 'parcial' : 'completo'}</td>
                    <td>{STATUS[i.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
