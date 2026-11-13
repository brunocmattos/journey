import { NOMES_ABAS, descrever, escreverCsv, type NomeAba, type Problema, type ResultadoImport } from '@journey/nucleo';
import type { JornadaCalculada } from './jornadas';

/** O que a tela de revisão mostra. Vai inteiro pro relatório do import (coluna relatorio). */
export interface Revisao {
  ok: boolean;
  parcial: boolean;
  erros: Problema[];
  avisos: Problema[];
  /** Itens por aba no documento efetivo. */
  contagem: Record<NomeAba, number>;
  diferencas: { novos: string[]; removidos: string[]; alterados: { chave: string; campos: string[] }[] };
  /** Por jornada: quantos achados de cada gravidade. */
  jornadas: { nome: string; canal: string; grave: number; alerta: number; observacao: number }[];
}

export function revisar(r: ResultadoImport, jornadas: JornadaCalculada[], parcial: boolean): Revisao {
  const contagem = Object.fromEntries(NOMES_ABAS.map((a) => [a, r.efetivo[a].length])) as Record<NomeAba, number>;
  return {
    ok: r.ok,
    parcial,
    erros: r.problemas.filter((p) => p.gravidade === 'erro'),
    avisos: r.problemas.filter((p) => p.gravidade === 'aviso'),
    contagem,
    diferencas: r.diferencas,
    jornadas: jornadas.map((j) => ({
      nome: j.nome,
      canal: j.canal,
      grave: j.diagnostico.filter((a) => a.gravidade === 'grave').length,
      alerta: j.diagnostico.filter((a) => a.gravidade === 'alerta').length,
      observacao: j.diagnostico.filter((a) => a.gravidade === 'observacao').length,
    })),
  };
}

/** O relatório de problemas em CSV (separador ;), pra baixar. */
export function relatorioCsv(problemas: readonly Problema[]): string {
  const cabecalho = ['gravidade', 'aba', 'linha', 'coluna', 'mensagem'];
  const linhas = problemas.map((p) => [p.gravidade, p.aba ?? '', p.linha === undefined ? '' : String(p.linha), p.coluna ?? '', descrever(p)].map(semFormula));
  return escreverCsv([cabecalho, ...linhas]);
}

/** O texto vem do arquivo de quem importou: começando com = + - @ (ou tab/CR), o Excel rodaria como fórmula. */
function semFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
