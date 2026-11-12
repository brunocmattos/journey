import { ABAS } from '../formato/abas';
import { lerCelula, paraCelula } from '../formato/celulas';
import { NOMES_ABAS, tabelasDe, type Documento, type LinhaGenerica, type NomeAba } from '../formato/documento';
import { igual } from '../util';
import { MSG_OBRIGATORIO_VAZIO, erroDeId, lerLinha, type FalhaCelula } from './analisar';

export type AjusteCampo = {
  tipo: 'campo';
  aba: NomeAba;
  id: string;
  campo: string;
  /**
   * Novo valor. Passa pelo mesmo leitor de célula do import: "180" numa coluna inteira vira 180.
   * undefined apaga o campo (coluna com padrão volta ao padrão; obrigatória sem padrão não pode).
   */
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

export interface AjusteInvalido {
  ajuste: Ajuste;
  /** Coluna com problema, quando é uma só. */
  coluna?: string;
  mensagem: string;
}

export interface ResultadoAjustes {
  efetivo: Documento;
  /** O ajuste continua valendo, mas a central mudou desde que ele foi feito. */
  conflitos: Conflito[];
  /** O alvo do ajuste não existe mais. Não foi aplicado. */
  orfaos: Ajuste[];
  /** A central já traz o mesmo valor do ajuste. */
  redundantes: Ajuste[];
  /** O ajuste não bate com as colunas da aba. Não foi aplicado. */
  invalidos: AjusteInvalido[];
}

/**
 * Aplica os ajustes manuais por cima da base, sem mexer na base.
 * Cada ajuste é checado contra as colunas da aba antes, pela mesma regra do import.
 */
export function aplicarAjustes(base: Documento, ajustes: readonly Ajuste[]): ResultadoAjustes {
  const efetivo = structuredClone(base);
  // O id do alvo pode chegar como número (JSON vindo de um banco): é comparado como texto.
  const t = tabelasDe(efetivo);
  const conflitos: Conflito[] = [];
  const orfaos: Ajuste[] = [];
  const redundantes: Ajuste[] = [];
  const invalidos: AjusteInvalido[] = [];

  const criacoes: CriarChecado[] = [];
  const campos: CampoChecado[] = [];
  for (const a of ajustes) {
    const c = a.tipo === 'criar' ? checarCriar(a) : checarCampo(a);
    if (!c.ok) invalidos.push({ ajuste: a, ...c.falha });
    else if ('linha' in c.valido) criacoes.push(c.valido);
    else campos.push(c.valido);
  }

  for (const { ajuste: a, aba, linha: nova } of criacoes) {
    const existente = t[aba].find((l) => l.id === nova.id);
    if (existente) {
      conflitos.push({ ajuste: a, atualDaCentral: existente });
      continue;
    }
    t[aba].push(nova);
  }

  for (const { ajuste: a, aba, valor, valorDaCentral } of campos) {
    const linha = t[aba].find((l) => l.id === String(a.id));
    if (!linha) {
      orfaos.push(a);
      continue;
    }
    const atual = linha[a.campo];
    if (igual(atual, valor)) {
      redundantes.push(a);
      continue;
    }
    if ('valorDaCentral' in a && !igual(atual, valorDaCentral)) conflitos.push({ ajuste: a, atualDaCentral: atual });
    if (valor === undefined) delete linha[a.campo];
    else linha[a.campo] = valor;
  }
  return { efetivo, conflitos, orfaos, redundantes, invalidos };
}

type CampoChecado = { ajuste: AjusteCampo; aba: NomeAba; valor: unknown; valorDaCentral: unknown };
type CriarChecado = { ajuste: AjusteCriar; aba: NomeAba; linha: LinhaGenerica };
type Falha = { coluna?: string; mensagem: string };
type Checagem<T> = { ok: true; valido: T } | { ok: false; falha: Falha };

const ehAba = (aba: unknown): aba is NomeAba => typeof aba === 'string' && (NOMES_ABAS as readonly string[]).includes(aba);
const abaInexistente = (aba: unknown): Falha => ({ mensagem: `a aba "${String(aba)}" não existe` });

function checarCampo(a: AjusteCampo): Checagem<CampoChecado> {
  if (!ehAba(a.aba)) return { ok: false, falha: abaInexistente(a.aba) };
  if (a.campo === 'id') return { ok: false, falha: { coluna: 'id', mensagem: 'o id não pode ser ajustado: é ele que liga o item à central' } };
  const coluna = ABAS[a.aba].colunas.find((c) => c.nome === a.campo);
  if (!coluna) return { ok: false, falha: { coluna: a.campo, mensagem: colunaInexistente(a.campo, a.aba) } };
  const r = lerCelula(coluna, paraCelula(a.valor));
  if (r === null && coluna.obrigatoria) return { ok: false, falha: { coluna: a.campo, mensagem: MSG_OBRIGATORIO_VAZIO } };
  if (r !== null && !r.ok) return { ok: false, falha: { coluna: a.campo, mensagem: r.erro } };
  // O valor que a central tinha também é lido, pra um "15" vindo do banco não virar conflito com 15.
  const central = a.valorDaCentral === undefined ? null : lerCelula(coluna, paraCelula(a.valorDaCentral));
  return {
    ok: true,
    valido: { ajuste: a, aba: a.aba, valor: r?.valor, valorDaCentral: central?.ok ? central.valor : a.valorDaCentral },
  };
}

function checarCriar(a: AjusteCriar): Checagem<CriarChecado> {
  if (!ehAba(a.aba)) return { ok: false, falha: abaInexistente(a.aba) };
  const linha: Record<string, unknown> = typeof a.linha === 'object' && a.linha !== null ? a.linha : {};
  const colunas = ABAS[a.aba].colunas;
  const falhas: FalhaCelula[] = Object.keys(linha)
    .filter((k) => !colunas.some((c) => c.nome === k))
    .map((k) => ({ coluna: k, mensagem: colunaInexistente(k, a.aba) }));
  const valores = Object.fromEntries(colunas.map((c) => [c.nome, paraCelula(linha[c.nome])]));  // id numérico vira texto aqui
  const lida = lerLinha(a.aba, valores);
  falhas.push(...lida.falhas);
  const id = lida.item.id as string | undefined;
  const erroId = id === undefined ? undefined : erroDeId(id);
  if (erroId) falhas.push({ coluna: 'id', mensagem: erroId });
  if (falhas.length === 1) return { ok: false, falha: falhas[0]! };
  if (falhas.length > 1) return { ok: false, falha: { mensagem: falhas.map((f) => `coluna ${f.coluna}: ${f.mensagem}`).join('; ') } };
  return { ok: true, valido: { ajuste: a, aba: a.aba, linha: lida.item as LinhaGenerica } };
}

const colunaInexistente = (coluna: string, aba: NomeAba) => `a coluna "${coluna}" não existe na aba ${aba}`;
