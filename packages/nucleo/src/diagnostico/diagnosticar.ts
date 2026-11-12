import type { Documento } from '../formato/documento';
import { indexar, type Indice } from '../formato/indice';
import { alcancaveis } from './alcance';
import { buracosDeHorario } from './horario';
import { becos, dadosIncompletos, horariosInexistentes, nosInativos, redundancias, semEntrada, voltasSemLimite } from './pecas';
import type { Achado } from './tipos';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, semTransbordo, voltaPropriaFila } from './transbordo';

const ORDEM = { grave: 0, alerta: 1, observacao: 2 } as const;

/** Todos os achados (empate na gravidade: ordem por código, igual em qualquer idioma), do mais grave pro mais leve. */
export function diagnosticar(fonte: Documento | Indice): Achado[] {
  const idx = 'formato' in fonte ? indexar(fonte) : fonte;
  const alc = alcancaveis(idx);
  const todos = [
    ...becos(idx, alc),
    ...destinosInexistentes(idx),
    ...horariosInexistentes(idx),
    ...ciclosDeTransbordo(idx),
    ...voltasSemLimite(idx, alc),
    ...redundancias(idx, alc),
    ...semEntrada(idx, alc),
    ...nosInativos(idx, alc),
    ...voltaPropriaFila(idx),
    ...gruposQueDesligam(idx),
    ...buracosDeHorario(idx, alc),
    ...esperaSemLimite(idx),
    ...planoBQueNaoDispara(idx),
    ...semTransbordo(idx, alc),
    ...dadosIncompletos(idx),
  ];
  return todos.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
}
