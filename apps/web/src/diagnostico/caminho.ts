import { indexar, lerRef, type Documento } from '@journey/nucleo';
import { ramos } from '@/mapa/montar';

/**
 * Um cenário que leva a água até um ponto, pra o "Simular" de um achado.
 * Usa o modo livre, em que tudo é perguntado (inclusive o relógio): as escolhas forçam o caminho, sem depender da hora.
 * Devolve null quando nenhuma entrada chega lá.
 */
export function cenarioAte(doc: Documento, alvo: string): { entrada: string; escolhas: string[] } | null {
  const idx = indexar(doc);
  let destino = alvo;
  let ultima: string | null = null;
  const sa = lerRef(alvo);
  if (sa?.tipo === 'saida') {
    const s = idx.saidas.get(sa.id);
    if (!s) return null;
    destino = s.de;
    ultima = perguntaEm(idx, s.de) ? `saida:${s.id}` : null;
  }

  // Busca em largura a partir de todas as entradas: o caminho mais curto.
  const anterior = new Map<string, { de: string; escolha: string | null }>();
  const fila: string[] = [];
  for (const e of idx.doc.entradas) {
    const ref = `entrada:${e.id}`;
    anterior.set(ref, { de: '', escolha: null });
    fila.push(ref);
  }
  while (fila.length > 0) {
    const ref = fila.shift()!;
    if (ref === destino) {
      const escolhas: string[] = [];
      let atual = ref;
      while (anterior.get(atual)!.de !== '') {
        const { de, escolha } = anterior.get(atual)!;
        if (escolha) escolhas.unshift(escolha);
        atual = de;
      }
      if (ultima) escolhas.push(ultima);
      return { entrada: atual, escolhas };
    }
    const pergunta = perguntaEm(idx, ref);
    for (const r of ramos(idx, ref)) {
      if (!r.simulavel || anterior.has(r.para)) continue;
      anterior.set(r.para, { de: ref, escolha: pergunta ? (r.saida ? `saida:${r.saida}` : r.opcao) : null });
      fila.push(r.para);
    }
  }
  return null;
}

/** No modo livre, o motor pergunta neste ponto? Mesma regra de quemDecide no motor. */
function perguntaEm(idx: ReturnType<typeof indexar>, ref: string): boolean {
  const r = lerRef(ref);
  if (!r) return false;
  if (r.tipo === 'fila' || r.tipo === 'grupo' || r.tipo === 'ramal') return true;
  if (r.tipo !== 'peca') return false;
  const p = idx.pecas.get(r.id);
  if (!p) return false;
  if (p.tipo === 'menu' || p.tipo === 'regra_horario' || p.tipo === 'regra_feriado') return true;
  return (idx.saidasDe.get(r.id)?.length ?? 0) > 1;
}
