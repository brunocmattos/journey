import { alcancaveis, diagnosticar, indexar, lerRef, type Achado, type Canal, type Documento } from '@journey/nucleo';

export interface JornadaCalculada {
  nome: string;
  canal: Canal;
  documento: Documento;
  diagnostico: Achado[];
  /** Referências do catálogo que a jornada usa ("onde é usado"). */
  refs: string[];
}

export const NOME_DO_CANAL: Record<Canal, string> = {
  telefonia: 'Telefonia',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  ocorrencia: 'Ocorrências',
};

/**
 * Uma jornada por canal das entradas, cada uma com as entradas daquele canal e o resto do documento.
 * Sem nenhuma entrada, uma jornada só, de telefonia (o canal padrão).
 */
export function jornadasDoImport(efetivo: Documento): JornadaCalculada[] {
  const canais = [...new Set(efetivo.entradas.map((e) => e.canal))];
  if (canais.length === 0) canais.push('telefonia');
  return canais.map((canal) => {
    const documento: Documento = canais.length === 1 ? efetivo : { ...efetivo, entradas: efetivo.entradas.filter((e) => e.canal === canal) };
    return { nome: NOME_DO_CANAL[canal], canal, documento, diagnostico: diagnosticar(documento), refs: refsUsadas(documento) };
  });
}

const DO_CATALOGO = new Set(['entrada', 'horario', 'ramal', 'fila', 'grupo']);

/** O que as entradas alcançam, mais os membros, a lista do siga-me e os horários das regras pelo caminho. */
export function refsUsadas(doc: Documento): string[] {
  const idx = indexar(doc);
  const usadas = new Set<string>();
  for (const ref of alcancaveis(idx)) {
    usadas.add(ref);
    const r = lerRef(ref);
    if (!r) continue;
    if (r.tipo === 'fila') for (const m of idx.filas.get(r.id)?.membros ?? []) usadas.add(m);
    if (r.tipo === 'grupo') for (const m of idx.grupos.get(r.id)?.membros ?? []) usadas.add(m);
    if (r.tipo === 'ramal') for (const m of idx.ramais.get(r.id)?.siga_me_lista ?? []) usadas.add(m);
    if (r.tipo === 'peca') {
      const h = idx.pecas.get(r.id)?.horario;
      if (h) usadas.add(h);
    }
  }
  return [...usadas].filter((ref) => DO_CATALOGO.has(lerRef(ref)?.tipo ?? '')).sort();
}
