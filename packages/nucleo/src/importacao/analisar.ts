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
}

/** Converte as linhas brutas em itens tipados, coluna por coluna. */
export function analisar(tabelas: Tabelas): Analise {
  const documento = documentoVazio();
  const destino = tabelasDe(documento);
  const problemas: Problema[] = [];
  const presentes: NomeAba[] = [];
  const linhas = new Map<string, number>();

  for (const aba of NOMES_ABAS) {
    const brutas = tabelas[aba];
    if (!brutas) continue;
    presentes.push(aba);
    const spec = ABAS[aba];
    const conhecidas = new Set(spec.colunas.map((c) => c.nome));
    const cabecalho = new Set(brutas.flatMap((l) => Object.keys(l.valores)));

    for (const nome of cabecalho) {
      if (!conhecidas.has(nome)) problemas.push({ gravidade: 'aviso', aba, coluna: nome, mensagem: `a coluna "${nome}" não existe nesta aba e foi ignorada` });
    }
    const faltando = new Set<string>();
    for (const c of spec.colunas) {
      if (c.obrigatoria && brutas.length > 0 && !cabecalho.has(c.nome)) {
        faltando.add(c.nome);
        problemas.push({ gravidade: 'erro', aba, coluna: c.nome, mensagem: `falta a coluna obrigatória "${c.nome}"` });
      }
    }

    const vistos = new Map<string, number>();
    for (const bruta of brutas) {
      const item: Record<string, unknown> = {};
      for (const c of spec.colunas) {
        if (faltando.has(c.nome)) continue;
        const r = lerCelula(c, bruta.valores[c.nome]);
        if (r === null) {
          if (c.obrigatoria) problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: c.nome, mensagem: 'campo obrigatório vazio' });
          continue;
        }
        if (!r.ok) {
          problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: c.nome, mensagem: r.erro });
          continue;
        }
        item[c.nome] = r.valor;
      }
      const id = item.id as string | undefined;
      if (id === undefined) continue;
      if (!PADRAO_ID.test(id)) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: `o id "${id}" tem caracteres inválidos. Use letras, números, ponto, hífen ou sublinhado` });
        continue;
      }
      const anterior = vistos.get(id);
      if (anterior !== undefined) {
        problemas.push({ gravidade: 'erro', aba, linha: bruta.linha, coluna: 'id', mensagem: `o id "${id}" se repete (já usado na linha ${anterior})` });
        continue;
      }
      vistos.set(id, bruta.linha);
      linhas.set(`${aba}/${id}`, bruta.linha);
      destino[aba].push(item as LinhaGenerica);
    }
  }
  return { documento, problemas, presentes, linhas };
}
