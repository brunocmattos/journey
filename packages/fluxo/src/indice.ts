import { formatarTempo } from './relogio';
import type { Conexao, Documento, Peca } from './documento';

/** O documento com acesso rápido: peça por id e saídas e entradas de cada peça (só conexões entre peças que existem). */
export interface Indice {
  doc: Documento;
  pecas: Map<string, Peca>;
  saidas: Map<string, Conexao[]>;
  entradas: Map<string, Conexao[]>;
}

export function indexar(doc: Documento): Indice {
  const pecas = new Map(doc.pecas.map((p) => [p.id, p]));
  const saidas = new Map<string, Conexao[]>(doc.pecas.map((p) => [p.id, []]));
  const entradas = new Map<string, Conexao[]>(doc.pecas.map((p) => [p.id, []]));
  for (const c of doc.conexoes) {
    if (!pecas.has(c.de) || !pecas.has(c.para)) continue;
    saidas.get(c.de)!.push(c);
    entradas.get(c.para)!.push(c);
  }
  return { doc, pecas, saidas, entradas };
}

/** O texto que a conexão mostra no cano e na opção da simulação. Vazio quando não há o que dizer. */
export function textoRegra(c: Conexao): string {
  switch (c.regra) {
    case 'opcao':
      return [c.valor, c.rotulo].filter(Boolean).join(' · ') || 'opção';
    case 'condicao':
      return c.valor ? `se ${c.valor}` : 'se…';
    case 'tempo':
      return `após ${formatarTempo(c.tempo_s ?? 0)}`;
    case 'horario':
      return c.horario === 'fora' ? 'fora do horário' : 'dentro do horário';
    case 'senao':
      return 'senão';
    default:
      return c.rotulo ?? '';
  }
}
