import { documentoVazio, type Documento, type Entrada, type Fila, type Grupo, type Horario, type Peca, type Ramal, type Saida, type TipoPeca } from '../src/formato/documento';

/** Documento com só as abas informadas. */
export const doc = (abas: Partial<Omit<Documento, 'formato'>>): Documento => ({ ...documentoVazio(), ...abas });

export const entrada = (id: string, destino: string, extra: Partial<Entrada> = {}): Entrada => ({ id, numero: id, canal: 'telefonia', destino, ativo: true, ...extra });

export const peca = (id: string, tipo: TipoPeca, extra: Partial<Peca> = {}): Peca => ({ id, tipo, ativo: true, ...extra });

/** Saída da peça `de` (id sem "peca:"). O id é "<de>-<opcao>", mais "-<valor>" quando há condição. */
export const saida = (de: string, opcao: string, para: string, extra: Partial<Saida> = {}): Saida => ({
  id: `${de}-${opcao}${extra.quando ? `-${extra.quando.valor}` : ''}`,
  de: `peca:${de}`,
  opcao,
  para,
  ativo: true,
  ...extra,
});

export const ramal = (id: string, extra: Partial<Ramal> = {}): Ramal => ({ id, transbordo_anti_loop: false, ...extra });

export const fila = (id: string, extra: Partial<Fila> = {}): Fila => ({ id, estrategia: 'rrmemory', toque_por_membro_s: 15, membros_dinamicos: false, ...extra });

export const grupo = (id: string, extra: Partial<Grupo> = {}): Grupo => ({ id, estrategia: 'ringall', toque_s: 20, ...extra });

export const janela = (grupo: string, dias: Horario['dias'], inicio: string, fim: string): Horario => ({ id: `${grupo}-${dias.join('')}-${inicio}`, grupo, dias, inicio, fim });
