import { CANAIS, ESTRATEGIAS_FILA, ESTRATEGIAS_GRUPO, TIPOS_PECA, TIPOS_RAMAL, type NomeAba } from './documento';
import type { TipoRef } from './refs';

export type TipoColuna = 'texto' | 'inteiro' | 'booleano' | 'enum' | 'ref' | 'refs' | 'hora' | 'data' | 'dias' | 'expressao' | 'opcao';

export interface Coluna {
  nome: string;
  tipo: TipoColuna;
  obrigatoria?: boolean;
  /** Valor usado quando a célula vem vazia. */
  padrao?: string;
  /** Valores permitidos (tipo enum). */
  valores?: readonly string[];
  /** Tipos de referência aceitos (tipos ref e refs). */
  refs?: readonly TipoRef[];
  descricao: string;
}

export interface Aba {
  nome: NomeAba;
  descricao: string;
  colunas: Coluna[];
  /** Linhas de exemplo, como texto de célula. Os exemplos de todas as abas formam um fluxo coerente. */
  exemplos: Record<string, string>[];
}

const ID: Coluna = { nome: 'id', tipo: 'texto', obrigatoria: true, descricao: 'Identificador estável. Use o mesmo da central, pra os ajustes sobreviverem ao próximo import.' };
const ATIVO: Coluna = { nome: 'ativo', tipo: 'booleano', padrao: 'sim', descricao: 'Use "nao" pra itens marcados como inativos na central.' };
const OBS: Coluna = { nome: 'observacao', tipo: 'texto', descricao: 'Nota livre.' };
const DESTINOS: readonly TipoRef[] = ['peca', 'fila', 'grupo', 'ramal', 'fim', 'externo'];
const MEMBROS: readonly TipoRef[] = ['ramal', 'externo'];

export const ABAS: Record<NomeAba, Aba> = {
  entradas: {
    nome: 'entradas',
    descricao: 'Números que recebem ligação e pra onde cada um vai.',
    colunas: [
      ID,
      { nome: 'numero', tipo: 'texto', obrigatoria: true, descricao: 'Número completo, só dígitos.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome pra mostrar no mapa.' },
      { nome: 'canal', tipo: 'enum', valores: CANAIS, padrao: 'telefonia', descricao: 'Canal da entrada.' },
      { nome: 'destino', tipo: 'ref', refs: DESTINOS, obrigatoria: true, descricao: 'Primeiro passo da ligação. Ex.: peca:feriado, ramal:2001.' },
      ATIVO,
      OBS,
    ],
    exemplos: [{ id: 'did-5130000001', numero: '5130000001', nome: 'Comercial', canal: 'telefonia', destino: 'peca:feriado' }],
  },
  horarios: {
    nome: 'horarios',
    descricao: 'Janelas de horário. Várias linhas com o mesmo grupo formam um grupo de horário.',
    colunas: [
      ID,
      { nome: 'grupo', tipo: 'texto', obrigatoria: true, descricao: 'Grupo de horário ao qual a janela pertence. É o que as peças usam: horario:<grupo>.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do grupo de horário.' },
      { nome: 'dias', tipo: 'dias', obrigatoria: true, descricao: 'Dias da semana: dom seg ter qua qui sex sab, ou faixa como seg-sex.' },
      { nome: 'inicio', tipo: 'hora', obrigatoria: true, descricao: 'Hora de início, HH:MM.' },
      { nome: 'fim', tipo: 'hora', obrigatoria: true, descricao: 'Hora de fim, HH:MM (não incluída).' },
      OBS,
    ],
    exemplos: [
      { id: 'atendimento-semana', grupo: 'atendimento', nome: 'Atendimento', dias: 'seg-sex', inicio: '08:30', fim: '18:00' },
      { id: 'atendimento-sabado', grupo: 'atendimento', nome: 'Atendimento', dias: 'sab', inicio: '09:00', fim: '12:00' },
    ],
  },
  feriados: {
    nome: 'feriados',
    descricao: 'Datas de feriado, agrupadas em calendários.',
    colunas: [
      ID,
      { nome: 'calendario', tipo: 'texto', obrigatoria: true, descricao: 'Nome do calendário. É o que as regras de feriado usam.' },
      { nome: 'data', tipo: 'data', obrigatoria: true, descricao: 'Data, AAAA-MM-DD.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do feriado.' },
      { nome: 'todo_ano', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se o feriado cai no mesmo dia todo ano.' },
      OBS,
    ],
    exemplos: [{ id: 'nacional-natal', calendario: 'nacional', data: '2026-12-25', nome: 'Natal', todo_ano: 'sim' }],
  },
  ramais: {
    nome: 'ramais',
    descricao: 'Ramais, quanto tempo tocam e pra onde vão se ninguém atende.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome de quem usa o ramal.' },
      { nome: 'tipo', tipo: 'enum', valores: TIPOS_RAMAL, descricao: 'pessoa, webphone ou setor.' },
      { nome: 'toque_s', tipo: 'inteiro', descricao: 'Segundos que o ramal toca antes de transbordar.' },
      { nome: 'siga_me_so_ramal_s', tipo: 'inteiro', descricao: 'Siga-me: segundos que toca só o ramal.' },
      { nome: 'siga_me_com_lista_s', tipo: 'inteiro', descricao: 'Siga-me: segundos que toca o ramal junto com a lista.' },
      { nome: 'siga_me_lista', tipo: 'refs', refs: MEMBROS, descricao: 'Siga-me: quem toca junto. Ex.: ramal:2001 externo:celular.' },
      { nome: 'ao_nao_atender', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se ninguém atende.' },
      { nome: 'ao_ocupado', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se o ramal está ocupado.' },
      { nome: 'ao_indisponivel', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se o ramal está desconectado.' },
      { nome: 'transbordo_anti_loop', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se o transbordo não volta pra fila quando a ligação veio dela.' },
      OBS,
    ],
    exemplos: [
      { id: '2001', nome: 'Ana', tipo: 'pessoa', toque_s: '20', ao_nao_atender: 'fila:100', transbordo_anti_loop: 'sim' },
      { id: '2002', nome: 'Beto', tipo: 'pessoa', toque_s: '27', siga_me_so_ramal_s: '7', siga_me_com_lista_s: '20', siga_me_lista: 'ramal:2001', ao_nao_atender: 'fim:caixa_postal' },
    ],
  },
  filas: {
    nome: 'filas',
    descricao: 'Filas de atendimento.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome da fila.' },
      { nome: 'estrategia', tipo: 'enum', valores: ESTRATEGIAS_FILA, obrigatoria: true, descricao: 'Como a fila escolhe quem toca.' },
      { nome: 'toque_por_membro_s', tipo: 'inteiro', descricao: 'Segundos que cada membro toca antes de passar pro próximo.' },
      { nome: 'espera_maxima_s', tipo: 'inteiro', descricao: 'Tempo máximo de espera. Vazio = sem limite.' },
      { nome: 'ao_esgotar', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai quando a espera máxima acaba.' },
      { nome: 'membros', tipo: 'refs', refs: MEMBROS, descricao: 'Membros fixos. Ex.: ramal:2001 ramal:2002.' },
      { nome: 'membros_dinamicos', tipo: 'booleano', padrao: 'nao', descricao: 'Use "sim" se atendentes entram e saem da fila sozinhos.' },
      { nome: 'pesquisa_ao_desligar', tipo: 'ref', refs: ['peca'], descricao: 'Peça de pesquisa que roda quando o atendente desliga.' },
      OBS,
    ],
    exemplos: [{ id: '100', nome: 'Atendimento', estrategia: 'rrmemory', toque_por_membro_s: '15', espera_maxima_s: '180', ao_esgotar: 'grupo:200', membros: 'ramal:2001 ramal:2002' }],
  },
  grupos: {
    nome: 'grupos',
    descricao: 'Grupos de toque.',
    colunas: [
      ID,
      { nome: 'nome', tipo: 'texto', descricao: 'Nome do grupo.' },
      { nome: 'estrategia', tipo: 'enum', valores: ESTRATEGIAS_GRUPO, obrigatoria: true, descricao: 'Como o grupo toca.' },
      { nome: 'toque_s', tipo: 'inteiro', descricao: 'Segundos que o grupo toca.' },
      { nome: 'ao_esgotar', tipo: 'ref', refs: DESTINOS, descricao: 'Pra onde vai se ninguém atende.' },
      { nome: 'membros', tipo: 'refs', refs: MEMBROS, descricao: 'Membros do grupo.' },
      OBS,
    ],
    exemplos: [{ id: '200', nome: 'Plantão', estrategia: 'ringall', toque_s: '20', ao_esgotar: 'fim:caixa_postal', membros: 'ramal:2001 ramal:2002' }],
  },
  pecas: {
    nome: 'pecas',
    descricao: 'Os passos do fluxo.',
    colunas: [
      ID,
      { nome: 'tipo', tipo: 'enum', valores: TIPOS_PECA, obrigatoria: true, descricao: 'Tipo da peça.' },
      { nome: 'nome', tipo: 'texto', descricao: 'Nome pra mostrar no mapa.' },
      { nome: 'horario', tipo: 'ref', refs: ['horario'], descricao: 'Regra de horário: o grupo de horário. Ex.: horario:atendimento.' },
      { nome: 'calendario', tipo: 'texto', descricao: 'Regra de feriado: o calendário. Ex.: nacional.' },
      { nome: 'espera_s', tipo: 'inteiro', descricao: 'Menu: segundos que espera a tecla.' },
      { nome: 'tentativas', tipo: 'inteiro', descricao: 'Menu: quantas vezes repete antes de esgotar.' },
      { nome: 'texto', tipo: 'texto', descricao: 'O que o áudio fala.' },
      { nome: 'duracao_s', tipo: 'inteiro', descricao: 'Duração do áudio em segundos.' },
      { nome: 'guarda_variavel', tipo: 'texto', descricao: 'Menu: nome da variável que a escolha guarda.' },
      { nome: 'canal', tipo: 'enum', valores: CANAIS, descricao: 'Canal em que a jornada segue a partir desta peça.' },
      { nome: 'id_central', tipo: 'texto', descricao: 'Identificador original na central, pra conferência.' },
      ATIVO,
      OBS,
    ],
    exemplos: [
      { id: 'feriado', tipo: 'regra_feriado', nome: 'Feriado?', calendario: 'nacional' },
      { id: 'horario', tipo: 'regra_horario', nome: 'Dentro do horário?', horario: 'horario:atendimento' },
      { id: 'menu-principal', tipo: 'menu', nome: 'Menu principal', espera_s: '5', tentativas: '3', texto: 'Digite 1 para atendimento ou 2 para falar com a Ana.' },
      { id: 'fora-do-horario', tipo: 'audio', nome: 'Fora do horário', texto: 'Nosso horário é de segunda a sexta, das 8h30 às 18h.', duracao_s: '9' },
      { id: 'encerra', tipo: 'fim', nome: 'Encerra' },
    ],
  },
  saidas: {
    nome: 'saidas',
    descricao: 'Os canos: de qual peça, por qual opção e pra onde.',
    colunas: [
      ID,
      { nome: 'de', tipo: 'ref', refs: ['peca'], obrigatoria: true, descricao: 'Peça de onde a saída parte.' },
      { nome: 'opcao', tipo: 'opcao', obrigatoria: true, descricao: 'Tecla (0-9, *, #) ou resultado: esgotou, sim, nao, ok, sempre…' },
      { nome: 'rotulo', tipo: 'texto', descricao: 'Nome da opção. Ex.: Boleto.' },
      { nome: 'quando', tipo: 'expressao', descricao: 'Só vale se a variável tiver esse valor. Ex.: tipo=aluguel.' },
      { nome: 'define', tipo: 'expressao', descricao: 'Guarda um valor numa variável ao passar. Ex.: tipo=aluguel.' },
      { nome: 'para', tipo: 'ref', refs: DESTINOS, obrigatoria: true, descricao: 'Pra onde a saída leva.' },
      ATIVO,
      OBS,
    ],
    exemplos: [
      { id: 'feriado-sim', de: 'peca:feriado', opcao: 'sim', para: 'peca:fora-do-horario' },
      { id: 'feriado-nao', de: 'peca:feriado', opcao: 'nao', para: 'peca:horario' },
      { id: 'horario-sim', de: 'peca:horario', opcao: 'sim', para: 'peca:menu-principal' },
      { id: 'horario-nao', de: 'peca:horario', opcao: 'nao', para: 'peca:fora-do-horario' },
      { id: 'menu-1', de: 'peca:menu-principal', opcao: '1', rotulo: 'Atendimento', para: 'fila:100' },
      { id: 'menu-2', de: 'peca:menu-principal', opcao: '2', rotulo: 'Falar com a Ana', para: 'ramal:2001' },
      { id: 'menu-esgotou', de: 'peca:menu-principal', opcao: 'esgotou', para: 'peca:encerra' },
      { id: 'fora-sempre', de: 'peca:fora-do-horario', opcao: 'sempre', para: 'peca:encerra' },
    ],
  },
};
