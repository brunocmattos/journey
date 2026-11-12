import type { Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';

const definidos = (...refs: (string | undefined)[]) => refs.filter((r): r is string => r !== undefined);

/**
 * Pra onde a ligação pode ir a partir de uma referência.
 * Membros de fila e grupo e a lista do siga-me só tocam: o transbordo pessoal deles não vale ali, então não são caminho.
 * Pontos inativos continuam no caminho; a regra de nó inativo depende disso.
 */
export function vizinhos(idx: Indice, ref: string): string[] {
  const r = lerRef(ref);
  if (!r) return [];
  switch (r.tipo) {
    case 'entrada': {
      const e = idx.entradas.get(r.id);
      return e ? [e.destino] : [];
    }
    case 'peca':
      return (idx.saidasDe.get(r.id) ?? []).map((s) => s.para);
    case 'ramal': {
      const x = idx.ramais.get(r.id);
      return x ? definidos(x.ao_nao_atender, x.ao_ocupado, x.ao_indisponivel) : [];
    }
    case 'fila': {
      const f = idx.filas.get(r.id);
      return f ? definidos(f.ao_esgotar, f.pesquisa_ao_desligar) : [];
    }
    case 'grupo': {
      const g = idx.grupos.get(r.id);
      return g ? definidos(g.ao_esgotar) : [];
    }
    default:
      return [];
  }
}

/** Tudo que alguma entrada alcança. */
export function alcancaveis(idx: Indice): Set<string> {
  const vistos = new Set<string>();
  const pilha = idx.doc.entradas.map((e) => `entrada:${e.id}`);
  while (pilha.length > 0) {
    const ref = pilha.pop()!;
    if (vistos.has(ref)) continue;
    vistos.add(ref);
    for (const v of vizinhos(idx, ref)) if (!vistos.has(v)) pilha.push(v);
  }
  return vistos;
}

/** Segue peças de saída única (que não são menu) até um ponto de decisão ou destino. */
export function destinoFinal(idx: Indice, ref: string): string {
  let atual = ref;
  for (let i = 0; i < 30; i++) {
    const r = lerRef(atual);
    if (r?.tipo !== 'peca') return atual;
    const p = idx.pecas.get(r.id);
    const saidas = idx.saidasDe.get(r.id) ?? [];
    if (!p || p.tipo === 'menu' || saidas.length !== 1) return atual;
    atual = saidas[0]!.para;
  }
  return atual;
}
