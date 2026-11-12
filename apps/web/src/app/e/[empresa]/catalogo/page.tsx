import Link from 'next/link';
import { ABAS, paraCelula, type NomeAba } from '@journey/nucleo';
import { catalogo, contagemCatalogo, ondeUsado } from '@/lib/dados';

/** As abas do catálogo (spec, 5): as peças e os canos são da jornada, não do catálogo. */
const ABAS_CATALOGO = ['entradas', 'horarios', 'feriados', 'ramais', 'filas', 'grupos'] as const satisfies readonly NomeAba[];
type AbaCatalogo = (typeof ABAS_CATALOGO)[number];
const PREFIXO: Record<AbaCatalogo, string | null> = { entradas: 'entrada', horarios: null, feriados: null, ramais: 'ramal', filas: 'fila', grupos: 'grupo' };

/** O texto da célula, como na planilha (expressão volta a "chave=valor"). */
function celula(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'chave' in v) {
    const e = v as unknown as { chave: string; valor: string };
    return `${e.chave}=${e.valor}`;
  }
  return paraCelula(v);
}

export default async function Catalogo({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ aba?: string; q?: string; item?: string }> }) {
  const { empresa: id } = await params;
  const sp = await searchParams;
  const aba: AbaCatalogo = (ABAS_CATALOGO as readonly string[]).includes(sp.aba ?? '') ? (sp.aba as AbaCatalogo) : 'ramais';
  const q = (sp.q ?? '').trim().toLowerCase();
  const [itens, contagem] = await Promise.all([catalogo(id, aba), contagemCatalogo(id)]);
  const filtrados = q ? itens.filter((i) => `${i.item_id} ${i.nome ?? ''} ${JSON.stringify(i.dados)}`.toLowerCase().includes(q)) : itens;
  const colunas = ABAS[aba].colunas.filter((c) => c.nome !== 'observacao');
  // Grupos de horário são o que as peças usam (horario:<grupo>); a linha é a janela.
  const refDoItem = (i: (typeof itens)[number]) => (aba === 'horarios' ? `horario:${String(i.dados.grupo)}` : PREFIXO[aba] ? `${PREFIXO[aba]}:${i.item_id}` : null);
  const selecionado = sp.item ? itens.find((i) => i.item_id === sp.item) : undefined;
  const ref = selecionado ? refDoItem(selecionado) : null;
  const usos = ref ? await ondeUsado(id, ref) : [];
  const link = (extra: Record<string, string>) => `?${new URLSearchParams({ aba, ...(q && { q }), ...extra })}`;

  return (
    <main className="pagina">
      <h1>Catálogo</h1>
      <nav className="nav" aria-label="Abas do catálogo" style={{ justifySelf: 'start' }}>
        {ABAS_CATALOGO.map((a) => (
          <Link key={a} href={`?aba=${a}`} aria-current={a === aba ? 'page' : undefined}>
            {a} <span className="mono mudo">{contagem[a] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <form className="linha-form">
        <input type="hidden" name="aba" value={aba} />
        <input className="entrada-texto" style={{ maxWidth: 360 }} type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por id, nome ou qualquer valor" aria-label="Buscar" />
        <button className="botao">Buscar</button>
      </form>
      {selecionado && (
        <div className="cartao" data-testid="onde-usado">
          <div className="cabeca">
            <h2>
              {selecionado.nome ?? selecionado.item_id} <span className="mono mudo">{ref ?? selecionado.item_id}</span>
            </h2>
            <Link className="botao pequeno" href={link({})}>
              Fechar
            </Link>
          </div>
          <div className="rotulo-secao">Onde é usado</div>
          {!ref ? (
            <p className="vazio">Feriados valem pelo calendário: a regra de feriado aponta pro calendário, não pro dia.</p>
          ) : usos.length === 0 ? (
            <p className="vazio">Nada aponta pra cá.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {usos.map((u) => (
                <li key={`${u.tipo}:${u.aba}:${u.item_id}`}>
                  {u.tipo === 'jornada' ? (
                    <Link href={`/e/${id}/j/${u.item_id}`}>Jornada {u.nome}</Link>
                  ) : (
                    <Link href={`?${new URLSearchParams({ aba: u.aba!, item: u.item_id })}`}>
                      {u.aba} · {u.nome ?? u.item_id}
                    </Link>
                  )}
                  {u.campos && <span className="mudo"> (em {u.campos.join(', ')})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="cartao">
        {filtrados.length === 0 ? (
          <p className="vazio">{itens.length === 0 ? 'Nada nesta aba. Importa a central pra preencher.' : 'Nada encontrado.'}</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela" data-testid="tabela-catalogo">
              <thead>
                <tr>
                  {colunas.map((c) => (
                    <th key={c.nome} title={c.descricao}>
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 1000).map((i) => (
                  <tr key={i.item_id} aria-selected={i.item_id === sp.item}>
                    {colunas.map((c, n) => (
                      <td key={c.nome} className={c.tipo === 'texto' ? undefined : 'mono'}>
                        {n === 0 ? <Link href={link({ item: i.item_id })}>{celula(i.dados[c.nome])}</Link> : celula(i.dados[c.nome])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
