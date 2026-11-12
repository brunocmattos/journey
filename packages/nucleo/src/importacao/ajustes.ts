import { tabelasDe, type Documento, type NomeAba } from '../formato/documento';
import { igual } from '../util';

export type AjusteCampo = {
  tipo: 'campo';
  aba: NomeAba;
  id: string;
  campo: string;
  /** Novo valor tipado. undefined apaga o campo. */
  valor: unknown;
  /** Valor da central quando o ajuste foi feito. Se a central mudar depois, vira conflito. */
  valorDaCentral?: unknown;
  nota?: string;
};

export type AjusteCriar = {
  tipo: 'criar';
  aba: NomeAba;
  linha: { id: string } & Record<string, unknown>;
  nota?: string;
};

export type Ajuste = AjusteCampo | AjusteCriar;

export interface Conflito {
  ajuste: Ajuste;
  /** O que a central traz agora. */
  atualDaCentral: unknown;
}

export interface ResultadoAjustes {
  efetivo: Documento;
  /** O ajuste continua valendo, mas a central mudou desde que ele foi feito. */
  conflitos: Conflito[];
  /** O alvo do ajuste não existe mais. Não foi aplicado. */
  orfaos: Ajuste[];
  /** A central já traz o mesmo valor do ajuste. */
  redundantes: Ajuste[];
}

/** Aplica os ajustes manuais por cima da base, sem mexer na base. */
export function aplicarAjustes(base: Documento, ajustes: readonly Ajuste[]): ResultadoAjustes {
  const efetivo = structuredClone(base);
  const t = tabelasDe(efetivo);
  const conflitos: Conflito[] = [];
  const orfaos: Ajuste[] = [];
  const redundantes: Ajuste[] = [];

  for (const a of ajustes) {
    if (a.tipo !== 'criar') continue;
    const existente = t[a.aba].find((l) => l.id === a.linha.id);
    if (existente) {
      conflitos.push({ ajuste: a, atualDaCentral: existente });
      continue;
    }
    t[a.aba].push(structuredClone(a.linha));
  }

  for (const a of ajustes) {
    if (a.tipo !== 'campo') continue;
    const linha = t[a.aba].find((l) => l.id === a.id);
    if (!linha) {
      orfaos.push(a);
      continue;
    }
    const atual = linha[a.campo];
    if (igual(atual, a.valor)) {
      redundantes.push(a);
      continue;
    }
    if ('valorDaCentral' in a && !igual(atual, a.valorDaCentral)) conflitos.push({ ajuste: a, atualDaCentral: atual });
    if (a.valor === undefined) delete linha[a.campo];
    else linha[a.campo] = structuredClone(a.valor);
  }
  return { efetivo, conflitos, orfaos, redundantes };
}
