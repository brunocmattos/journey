import { NOMES_ABAS, type Problema } from '@journey/nucleo';
import { importDaEmpresa } from '@/lib/dados';
import { BotoesRevisao } from './botoes';
import { FUSO } from '@/lib/fuso';

function Problemas({ titulo, lista, classe }: { titulo: string; lista: Problema[]; classe: 'grave' | 'alerta' }) {
  if (lista.length === 0) return null;
  return (
    <div className="cartao">
      <h2>
        {titulo} <span className={`selo ${classe}`}>{lista.length}</span>
      </h2>
      <div className="tabela-rolagem">
        <table className="tabela" data-testid={`problemas-${classe}`}>
          <thead>
            <tr>
              <th>Aba</th>
              <th>Linha</th>
              <th>Coluna</th>
              <th>O que houve</th>
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, 500).map((p, i) => (
              <tr key={i}>
                <td className="mono">{p.aba ?? '—'}</td>
                <td className="mono">{p.linha ?? p.id ?? '—'}</td>
                <td className="mono">{p.coluna ?? '—'}</td>
                <td>{p.mensagem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lista.length > 500 && <p className="mudo">Mostrando 500 de {lista.length}. Baixa o relatório pra ver todos.</p>}
    </div>
  );
}

export default async function Revisao({ params }: { params: Promise<{ empresa: string; import: string }> }) {
  const { empresa: empresaId, import: importId } = await params;
  const imp = await importDaEmpresa(empresaId, importId);
  const r = imp.relatorio;
  const d = r.diferencas;
  return (
    <main className="pagina">
      <div className="cabeca">
        <h1>Revisão do import</h1>
        <span className={`selo ${r.ok ? 'ok' : 'grave'}`}>{r.ok ? 'pode confirmar' : `${r.erros.length} erros bloqueiam`}</span>
      </div>
      <p className="mudo">
        {imp.arquivos.map((a) => a.nome).join(', ')} · {r.parcial ? 'parcial' : 'completo'} · {new Date(imp.criado_em).toLocaleString('pt-BR', { timeZone: FUSO })}
      </p>
      <div className="cartao">
        <h2>O que entra</h2>
        <div className="numeros" data-testid="contagem">
          {NOMES_ABAS.map((a) => (
            <span key={a}>
              <b>{r.contagem[a]}</b>
              {a}
            </span>
          ))}
        </div>
        <div className="numeros" style={{ marginTop: 10 }}>
          <span>
            <b>{d.novos.length}</b>novos
          </span>
          <span>
            <b>{d.alterados.length}</b>alterados
          </span>
          <span>
            <b>{d.removidos.length}</b>removidos
          </span>
        </div>
        {d.removidos.length > 0 && <p className="mudo">Removidos: {d.removidos.slice(0, 20).join(', ')}{d.removidos.length > 20 ? '…' : ''}</p>}
      </div>
      <div className="cartao">
        <h2>Diagnóstico de cada jornada</h2>
        <div className="numeros">
          {r.jornadas.map((j) => (
            <span key={j.nome}>
              {j.nome}: <span className="selo grave">{j.grave} graves</span> <span className="selo alerta">{j.alerta} alertas</span>{' '}
              <span className="selo observacao">{j.observacao} observações</span>
            </span>
          ))}
        </div>
        <p className="mudo">Achados não bloqueiam: é o que o diagnóstico vai mostrar no mapa depois de confirmar.</p>
      </div>
      <Problemas titulo="Erros" lista={r.erros} classe="grave" />
      <Problemas titulo="Avisos" lista={r.avisos} classe="alerta" />
      {imp.status === 'revisao' ? (
        <BotoesRevisao empresaId={empresaId} importId={importId} ok={r.ok} temProblemas={r.erros.length + r.avisos.length > 0} />
      ) : (
        <p className="aviso-caixa info">Este import foi {imp.status}.</p>
      )}
    </main>
  );
}
