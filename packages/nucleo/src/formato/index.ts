export { TIPOS_REF, REFS_EMBUTIDAS, PADRAO_ID, lerRef, montarRef, ehEmbutida, type TipoRef, type RefLida } from './refs';
export {
  NOMES_ABAS,
  DIAS,
  CANAIS,
  TIPOS_PECA,
  TIPOS_RAMAL,
  ESTRATEGIAS_FILA,
  ESTRATEGIAS_GRUPO,
  documentoVazio,
  tabelasDe,
  type NomeAba,
  type Dia,
  type Canal,
  type TipoPeca,
  type Expressao,
  type Entrada,
  type Horario,
  type Feriado,
  type Ramal,
  type Fila,
  type Grupo,
  type Peca,
  type Saida,
  type Documento,
  type LinhaGenerica,
} from './documento';
export { ABAS, type TipoColuna, type Coluna, type Aba } from './abas';
export { lerCelula, paraCelula, type ResultadoCelula } from './celulas';
export { indexar, existe, nomeDe, type Indice } from './indice';
export { completude, regrasDeRelogioIncompletas, type RegraCompletude, type Pendencia } from './completude';
