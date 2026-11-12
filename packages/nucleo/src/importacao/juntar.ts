import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { igual } from '../util';

export interface OpcoesJuntar {
  /** Abas que vieram no import. */
  presentes: readonly NomeAba[];
  /** Parcial: só as abas presentes mudam, e o que não veio nelas fica. Completo: o arquivo substitui tudo. */
  parcial: boolean;
  /**
   * Parcial: colunas que vieram em cada aba. Numa linha que já existia, só elas substituem o valor antigo
   * (vazia = limpa); as outras ficam como estavam. Sem isto, a linha inteira é substituída.
   */
  colunas?: Partial<Record<NomeAba, ReadonlySet<string>>>;
  /** Parcial, JSON: colunas que cada item trouxe, por "aba/id". Vale no lugar de `colunas` pra esse item (chave ausente = não informado). */
  colunasPorItem?: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Linha antiga com as colunas que vieram trocadas pelas da linha nova. */
function mesclar<T extends { id: string }>(velha: T, nova: T, colunas: ReadonlySet<string>): T {
  const out: Record<string, unknown> = structuredClone(velha);
  const n = nova as Record<string, unknown>;
  for (const c of colunas) {
    if (c === 'id') continue;
    if (n[c] === undefined) delete out[c];
    else out[c] = structuredClone(n[c]);
  }
  return out as T;
}

/** Monta a nova base a partir da base anterior e do que veio no import. */
export function juntar(anterior: Documento | null | undefined, novo: Documento, opcoes: OpcoesJuntar): Documento {
  const out = documentoVazio();
  const destino = tabelasDe(out);
  const antes = tabelasDe(anterior ?? documentoVazio());
  const agora = tabelasDe(novo);
  for (const aba of NOMES_ABAS) {
    if (!opcoes.parcial) {
      destino[aba] = structuredClone(agora[aba]);
      continue;
    }
    if (!opcoes.presentes.includes(aba)) {
      destino[aba] = structuredClone(antes[aba]);
      continue;
    }
    const novos = new Map(agora[aba].map((l) => [l.id, l] as const));
    const colunas = opcoes.colunas?.[aba];
    const juntas = antes[aba].map((l) => {
      const n = novos.get(l.id);
      if (!n) return structuredClone(l);
      const doItem = opcoes.colunasPorItem?.get(`${aba}/${l.id}`) ?? colunas;
      return doItem ? mesclar(l, n, doItem) : structuredClone(n);
    });
    const jaTinha = new Set(antes[aba].map((l) => l.id));
    for (const l of agora[aba]) if (!jaTinha.has(l.id)) juntas.push(structuredClone(l));
    destino[aba] = juntas;
  }
  return out;
}

export interface Diferencas {
  /** Chaves "aba/id". */
  novos: string[];
  removidos: string[];
  alterados: { chave: string; campos: string[] }[];
}

/** O que mudou entre duas versões da base, pra tela de revisão. */
export function diferencas(antes: Documento | null | undefined, depois: Documento): Diferencas {
  const out: Diferencas = { novos: [], removidos: [], alterados: [] };
  const a = tabelasDe(antes ?? documentoVazio());
  const b = tabelasDe(depois);
  for (const aba of NOMES_ABAS) {
    const velhos = new Map(a[aba].map((l) => [l.id, l] as const));
    const atuais = new Map(b[aba].map((l) => [l.id, l] as const));
    for (const [id, l] of atuais) {
      const v = velhos.get(id);
      if (!v) {
        out.novos.push(`${aba}/${id}`);
        continue;
      }
      const campos = [...new Set([...Object.keys(v), ...Object.keys(l)])].filter((k) => !igual(v[k], l[k]));
      if (campos.length) out.alterados.push({ chave: `${aba}/${id}`, campos });
    }
    for (const id of velhos.keys()) if (!atuais.has(id)) out.removidos.push(`${aba}/${id}`);
  }
  return out;
}
