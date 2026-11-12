import type { Documento } from '../formato/documento';
import { indexar, type Indice } from '../formato/indice';
import { alcancaveis } from './alcance';
import { buracosDeHorario } from './horario';
import { becos, dadosIncompletos, nosInativos, redundancias, semEntrada, voltasSemLimite } from './pecas';
import type { Achado } from './tipos';
import { ciclosDeTransbordo, destinosInexistentes, esperaSemLimite, gruposQueDesligam, planoBQueNaoDispara, voltaPropriaFila } from './transbordo';

const ORDEM = { grave: 0, alerta: 1, observacao: 2 } as const;

/** Todos os achados, do mais grave pro mais leve. */
export function diagnosticar(fonte: Documento | Indice): Achado[] {
  const idx = 'formato' in fonte ? indexar(fonte) : fonte;
  const alc = alcancaveis(idx);
  const todos = [
    ...becos(idx, alc),
    ...destinosInexistentes(idx),
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
    ...dadosIncompletos(idx),
  ];
  return todos.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade] || a.chave.localeCompare(b.chave));
}
