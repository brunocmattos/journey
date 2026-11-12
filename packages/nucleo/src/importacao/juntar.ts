import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { igual } from '../util';

export interface OpcoesJuntar {
  /** Abas que vieram no import. */
  presentes: readonly NomeAba[];
  /** Parcial: só as abas presentes mudam, e o que não veio nelas fica. Completo: o arquivo substitui tudo. */
  parcial: boolean;
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
    const juntas = antes[aba].map((l) => structuredClone(novos.get(l.id) ?? l));
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
