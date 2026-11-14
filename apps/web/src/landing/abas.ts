/**
 * As abas dos exemplos: o nome, a dor em uma frase e a cor do canal de cada um (a dos canais padrão). Sem o
 * @journey/fluxo: as abas e as miniaturas vêm no primeiro carregamento; os retratos (exemplos.ts), só com o visualizador.
 */
export const ABAS = [
  { chave: 'ura', nome: 'URA telefônica', dor: 'O cliente que aperta 9 e não chega em lugar nenhum.', cor: '#1e8bdc' },
  { chave: 'whatsapp', nome: 'Suporte no WhatsApp', dor: 'O bot que manda o cliente de volta pro começo.', cor: '#159e5a' },
  { chave: 'email', nome: 'SAC por e-mail', dor: 'O chamado que fica dois dias parado antes de alguém escalar.', cor: '#c98410' },
  { chave: 'credito', nome: 'Esteira de crédito', dor: 'A proposta parada horas na análise manual.', cor: '#3a6a88' },
] as const;

export type ChaveAba = (typeof ABAS)[number]['chave'];

/**
 * O id do botão da aba (`aba-ura`). Diferente do hash: com um elemento de id `exemplo-ura`, o navegador rolaria até a
 * aba, e não até o começo da seção.
 */
export const idDaAba = (chave: ChaveAba): string => `aba-${chave}`;

/** O endereço de um exemplo: `#exemplo-ura`, pra dar pra mandar o link dele. */
export const hashDaAba = (chave: ChaveAba): string => `#exemplo-${chave}`;

/** A aba de um endereço (`#exemplo-credito`), ou null quando o hash não é de exemplo nenhum. */
export function abaDoHash(hash: string): ChaveAba | null {
  const chave = /^#exemplo-([a-z]+)$/.exec(hash)?.[1];
  return ABAS.find((a) => a.chave === chave)?.chave ?? null;
}

/** A aba seguinte numa tecla da lista de abas (setas, Home e End), dando a volta nas pontas; null pras outras teclas. */
export function abaDaTecla(atual: ChaveAba, tecla: string): ChaveAba | null {
  const i = ABAS.findIndex((a) => a.chave === atual);
  const n = ABAS.length;
  const j = tecla === 'Home' ? 0 : tecla === 'End' ? n - 1 : tecla === 'ArrowRight' ? (i + 1) % n : tecla === 'ArrowLeft' ? (i - 1 + n) % n : null;
  return j === null ? null : ABAS[j]!.chave;
}
