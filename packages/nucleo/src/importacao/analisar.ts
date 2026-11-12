import { ABAS } from '../formato/abas';
import { lerCelula } from '../formato/celulas';
import { NOMES_ABAS, documentoVazio, tabelasDe, type Documento, type LinhaGenerica, type NomeAba } from '../formato/documento';
import { PADRAO_ID } from '../formato/refs';
import type { Tabelas } from './ler-arquivos';
import type { Problema } from './problemas';

export interface Analise {
  documento: Documento;
  problemas: Problema[];
  /** Abas que vieram nos arquivos. */
  presentes: NomeAba[];
  /** Linha de origem de cada item, por "aba/id". */
  linhas: Map<string, number>;
  /** Colunas conhecidas que vieram em cada aba (união das chaves das linhas). Base do import parcial por coluna. */
  colunas: Partial<Record<NomeAba, Set<string>>>;
  /**
   * Só JSON: colunas conhecidas que cada item trouxe, por "aba/id". No import parcial, o que não veio no item
   * fica como estava (vale no lugar de `colunas` pra esse item). Itens de .xlsx/.csv não aparecem aqui.
   */
  colunasPorItem: Map<string, ReadonlySet<string>>;
}

export interface OpcoesAnalisar {
  /**
   * Import parcial: ids que já existem na base anterior, por aba. Quando informado, a falta de coluna
   * obrigatória só é erro nas linhas novas (id fora do conjunto); as linhas existentes herdam o valor anterior.
   * A coluna `id` continua sendo exigida na aba toda.
   */
  existentes?: Partial<Record<NomeAba, ReadonlySet<string>>>;
}

/** Converte as linhas brutas em itens tipados, coluna por coluna. */
export function analisar(tabelas: Tabelas, opcoes: OpcoesAnalisar = {}): Analise {
  const documento = documentoVazio();
  const destino = tabelasDe(documento);
  const problemas: Problema[] = [];
  const presentes: NomeAba[] = [];
  const linhas = new Map<string, number>();
  const colunas: Analise['colunas'] = {};
  const colunasPorItem = new Map<string, ReadonlySet<string>>();

  for (const aba of NOMES_ABAS) {
    const brutas = tabelas[aba];
    if (!brutas) continue;
    presentes.push(aba);
    const spec = ABAS[aba];
    const conhecidas = new Set(spec.colunas.map((c) => c.nome));
    const cabecalho = new Set(brutas.flatMap((l) => Object.keys(l.valores)));

    colunas[aba] = new Set([...cabecalho].filter((n) => conhecidas.has(n)));

    for (const nome of cabecalho) {
      if (!conhecidas.has(nome)) problemas.push({ gravidade: 'aviso', aba, coluna: nome, mensagem: `a coluna "${nome}" não existe nesta aba e foi ignorada` });
    }
    const faltando = new Set<string>();
    /** Parcial: faltando (exceto id) só pesa nas linhas novas. */
    const porLinha = opcoes.existentes !== undefined;
    for (const c of spec.colunas) {
      if (c.obrigatoria && brutas.length > 0 && !cabecalho.has(c.nome)) {
        faltando.add(c.nome);
        if (porLinha && c.nome !== 'id') continue;
        problemas.push({ gravidade: 'erro', aba, coluna: c.nome, mensagem: `falta a coluna obrigatória "${c.nome}"` });
      }
    }

    const vistos = new Map<string, number>();
    for (const bruta of brutas) {
      // Ausentes nesta linha: as colunas que faltam na aba e, no JSON parcial, as chaves que o item não trouxe.
      const ausentes = new Set(faltando);
      const idBruto = Object.hasOwn(bruta.valores, 'id') ? bruta.valores.id?.trim() : undefined;
      const nova = porLinha && !(idBruto !== undefined && (opcoes.existentes?.[aba]?.has(idBruto) ?? false));
      if (porLinha && bruta.presentes) {
        for (const c of spec.colunas) {
          if (bruta.presentes.has(c.nome)) continue;
          if (!nova || (c.obrigatoria && c.nome !== 'id')) ausentes.add(c.nome);
        }
      }
      const { item, falhas } = lerLinha(aba, bruta.valores, ausentes);
      for (const f of falhas) problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, ...f });
      const id = item.id as string | undefined;
      if (id === undefined) continue;
      const erroId = erroDeId(id);
      if (erroId) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: erroId });
        continue;
      }
      if (nova) {
        for (const c of spec.colunas) {
          if (c.obrigatoria && c.nome !== 'id' && ausentes.has(c.nome)) {
            problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: c.nome, mensagem: `falta a coluna obrigatória "${c.nome}" (necessária para criar o item novo "${id}")` });
          }
        }
      }
      const anterior = vistos.get(id);
      if (anterior !== undefined) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: `o id "${id}" se repete (já usado na linha ${anterior})` });
        continue;
      }
      vistos.set(id, bruta.linha);
      if (bruta.presentes) colunasPorItem.set(`${aba}/${id}`, new Set([...bruta.presentes].filter((n) => conhecidas.has(n))));
      linhas.set(`${aba}/${id}`, bruta.linha);
      destino[aba].push(item as LinhaGenerica);
    }
  }
  return { documento, problemas, presentes, linhas, colunas, colunasPorItem };
}

export const MSG_OBRIGATORIO_VAZIO = 'campo obrigatório vazio';

export interface FalhaCelula {
  coluna: string;
  mensagem: string;
}

/**
 * Lê uma linha coluna por coluna, pela regra do import: célula vazia pega o padrão da coluna,
 * e obrigatória sem padrão vazia é falha. Colunas em `pular` ficam de fora.
 */
export function lerLinha(
  aba: NomeAba,
  valores: Readonly<Record<string, string | undefined>>,
  pular: ReadonlySet<string> = new Set(),
): { item: Record<string, unknown>; falhas: FalhaCelula[] } {
  const item: Record<string, unknown> = {};
  const falhas: FalhaCelula[] = [];
  for (const c of ABAS[aba].colunas) {
    if (pular.has(c.nome)) continue;
    const r = lerCelula(c, Object.hasOwn(valores, c.nome) ? valores[c.nome] : undefined);
    if (r === null) {
      if (c.obrigatoria) falhas.push({ coluna: c.nome, mensagem: MSG_OBRIGATORIO_VAZIO });
      continue;
    }
    if (!r.ok) {
      falhas.push({ coluna: c.nome, mensagem: r.erro });
      continue;
    }
    item[c.nome] = r.valor;
  }
  return { item, falhas };
}

/** Mensagem quando o id tem caracteres que não podem; undefined quando o id é válido. */
export function erroDeId(id: string): string | undefined {
  return PADRAO_ID.test(id) ? undefined : `o id "${id}" tem caracteres inválidos. Use letras, números, ponto, hífen ou sublinhado`;
}
