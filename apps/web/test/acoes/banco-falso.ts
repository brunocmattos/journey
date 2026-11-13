/**
 * Um Supabase de mentira pras server actions: cada consulta registra tabela, operação, valores e filtros, e responde
 * com a próxima resposta da fila `tabela.operação` (ou vazio).
 */
export type Resposta = { data?: unknown; error: { code?: string; message: string } | null };
export interface Feita {
  tabela: string;
  op: string;
  valores?: unknown;
  filtros: [string, unknown][];
}

export function bancoFalso() {
  const filas: Record<string, Resposta[]> = {};
  const feitas: Feita[] = [];
  const responder = (chave: string): Resposta => filas[chave]?.shift() ?? { data: null, error: null };
  const from = (tabela: string) => {
    const f: Feita = { tabela, op: 'select', filtros: [] };
    feitas.push(f);
    const r = () => responder(`${tabela}.${f.op}`);
    const q: Record<string, unknown> = {
      then: (ok: (v: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(r()).then(ok, falha),
      single: async () => r(),
      maybeSingle: async () => r(),
      select: () => q,
      order: () => q,
    };
    for (const m of ['eq', 'in', 'ilike']) q[m] = (c: string, v: unknown) => (f.filtros.push([c, v]), q);
    for (const m of ['insert', 'update', 'delete', 'upsert'])
      q[m] = (valores?: unknown) => {
        f.op = m;
        f.valores = valores;
        return q;
      };
    return q;
  };
  const rpc = async (nome: string, args: unknown) => {
    feitas.push({ tabela: `rpc:${nome}`, op: 'rpc', valores: args, filtros: [] });
    return responder(`rpc.${nome}`);
  };
  return {
    supabase: { from, rpc },
    feitas,
    /** Enfileira respostas pra `tabela.op` (ex.: 'fluxos.insert', 'rpc.salvar_fluxo'). */
    quando: (chave: string, ...rs: Resposta[]) => (filas[chave] = [...(filas[chave] ?? []), ...rs]),
    limpar: () => {
      for (const k of Object.keys(filas)) delete filas[k];
      feitas.length = 0;
    },
  };
}
