import { FORMATO, type Conexao, type Documento, type Peca, type TipoPeca } from '../src/documento';

/** Construtores de documentos pequenos pros testes. Posição não importa pro motor nem pro diagnóstico. */
export const peca = (id: string, tipo: TipoPeca, extra: Partial<Peca> = {}): Peca => ({ id, tipo, nome: extra.nome ?? id, x: 0, y: 0, ...extra });
export const liga = (de: string, para: string, extra: Partial<Conexao> = {}): Conexao => ({ id: extra.id ?? `${de}>${para}`, de, para, regra: 'sempre', ...extra });
export const doc = (pecas: Peca[], conexoes: Conexao[] = []): Documento => ({ formato: FORMATO, pecas, conexoes, grupos: [], notas: [] });
