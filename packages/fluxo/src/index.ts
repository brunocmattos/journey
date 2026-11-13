export { FORMATO, TIPOS_PECA, NOMES_TIPOS, REGRAS, documentoVazio, type TipoPeca, type Regra, type Peca, type Conexao, type Grupo, type Nota, type Documento } from './documento';
export { DIAS, CANAIS_PADRAO, TIPOS_CADASTRO_PADRAO, camposHorario, type Cadastro, type Canal, type Dia, type JanelaHorario, type Feriado, type CamposHorario } from './cadastros';
export { lerDocumento, LIMITES, type Problema, type Leitura, type Conhecidos } from './validar';
export { indexar, textoRegra, type Indice } from './indice';
export { lerQuando, dentroDoHorario, ehFeriado, formatarTempo } from './relogio';
export { Execucao, executar, simular, type Contexto, type Modo, type OpcoesExecucao, type Opcao, type QuemEscolheu, type MotivoFim, type Evento } from './motor';
export { diagnosticar, type Achado, type Gravidade, type OpcoesDiagnostico } from './diagnostico';
export { MODELOS, type Modelo } from './modelos';
