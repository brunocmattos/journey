import type { Cadastro, CamposHorario, Documento, TipoPeca } from '@journey/fluxo';

/** Um tipo de cadastro da empresa: chave (pessoa, fila…) e nome. */
export interface TipoCadastro {
  chave: string;
  nome: string;
}

/** Comparar nomes como o banco compara (índice único em lower(btrim(nome))). */
export const nomeNormalizado = (nome: string): string => nome.trim().toLowerCase();

/** O Horário que nasce do uso: segunda a sexta, 8h às 18h, sem feriado. Dá pra mudar na tela de Cadastros. */
export const HORARIO_PADRAO: CamposHorario = { janelas: [{ dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' }], feriados: [] };

/**
 * O tipo mais provável pra um nome novo escrito numa peça: "Fila …" é fila, "Equipe …"/"Time …" é equipe,
 * "Horário …" é horário, peça Sistema é sistema; o resto é pessoa (o tipo dá pra trocar antes de criar).
 */
export function tipoSugerido(nome: string, tipoPeca: TipoPeca, tipos: readonly TipoCadastro[]): string {
  const n = nomeNormalizado(nome);
  const tem = (k: string) => tipos.some((t) => t.chave === k);
  const escolha = n.startsWith('fila')
    ? 'fila'
    : n.startsWith('equipe') || n.startsWith('time')
      ? 'equipe'
      : n.includes('horário') || n.includes('horario')
        ? 'horario'
        : tipoPeca === 'sistema'
          ? 'sistema'
          : tipoPeca === 'decisao'
            ? 'horario'
            : 'pessoa';
  return tem(escolha) ? escolha : (tipos[0]?.chave ?? 'pessoa');
}

/** Cadastros que batem com o que a pessoa escreveu (o nome começa ou contém), os que começam primeiro. */
export function buscar(cadastros: readonly Cadastro[], termo: string, limite = 8): Cadastro[] {
  const t = nomeNormalizado(termo);
  if (!t) return cadastros.slice(0, limite);
  const comeca = cadastros.filter((k) => nomeNormalizado(k.nome).startsWith(t));
  const contem = cadastros.filter((k) => !nomeNormalizado(k.nome).startsWith(t) && nomeNormalizado(k.nome).includes(t));
  return [...comeca, ...contem].slice(0, limite);
}

/** O cadastro com exatamente este nome (sem caixa nem espaços), se existe. */
export const comNome = (cadastros: readonly Cadastro[], nome: string): Cadastro | undefined => cadastros.find((k) => nomeNormalizado(k.nome) === nomeNormalizado(nome));

/** Quantas peças deste documento usam cada cadastro. */
export function usosNoDocumento(doc: Documento): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of doc.pecas) if (p.responsavel) m.set(p.responsavel, (m.get(p.responsavel) ?? 0) + 1);
  return m;
}
