import { FORMATO, type Conexao, type Documento, type Peca, type TipoPeca } from './documento';
import type { Cadastro } from './cadastros';

/**
 * Fluxos prontos pra começar. Os ids dos cadastros aqui são locais ao modelo (e não se repetem entre modelos):
 * quem copia um modelo pra uma empresa acha ou cria o cadastro da empresa com o mesmo nome e tipo e usa
 * `instanciarModelo` pra trocar os ids. Os modelos são congelados: nunca edite um, copie.
 */
export interface Modelo {
  chave: 'whatsapp' | 'credito' | 'email' | 'ura';
  nome: string;
  descricao: string;
  canal: string;
  documento: Documento;
  cadastros: Cadastro[];
}

const peca = (id: string, tipo: TipoPeca, x: number, y: number, nome: string, extra: Partial<Peca> = {}): Peca => ({ id, tipo, nome, x, y, ...extra });
const liga = (id: string, de: string, para: string, extra: Partial<Conexao> = {}): Conexao => ({ id, de, para, regra: 'sempre', ...extra });
/** Congela o objeto e tudo dentro dele. */
function congelar<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}
const doc = (pecas: Peca[], conexoes: Conexao[], extra: Partial<Documento> = {}): Documento => ({ formato: FORMATO, pecas, conexoes, grupos: [], notas: [], ...extra });

const HORARIO_COMERCIAL: Cadastro = {
  id: 'horario-comercial',
  tipo: 'horario',
  nome: 'Horário comercial',
  campos: {
    janelas: [
      { dias: ['seg', 'ter', 'qua', 'qui', 'sex'], inicio: '08:00', fim: '18:00' },
      { dias: ['sab'], inicio: '09:00', fim: '12:00' },
    ],
    feriados: [{ data: '2026-12-25', todo_ano: true, nome: 'Natal' }],
  },
};

export const MODELOS: readonly Modelo[] = congelar([
  {
    chave: 'whatsapp',
    nome: 'Suporte no WhatsApp',
    descricao: 'Bot de boas-vindas, horário de atendimento, menu de assuntos, filas e encerramento por inatividade.',
    canal: 'whatsapp',
    cadastros: [HORARIO_COMERCIAL, { id: 'fila-financeiro', tipo: 'fila', nome: 'Fila Financeiro' }, { id: 'fila-suporte-tecnico', tipo: 'fila', nome: 'Fila Suporte técnico' }],
    documento: doc(
      [
        peca('inicio', 'inicio', 0, 40, 'Cliente manda mensagem', { canal: 'whatsapp' }),
        peca('boas-vindas', 'mensagem', 260, 39, 'Boas-vindas do bot', { tempo_s: 3 }),
        peca('horario', 'decisao', 540, 0, 'Dentro do horário?', { responsavel: 'horario-comercial' }),
        peca('assunto', 'decisao', 900, -80, 'Qual assunto?'),
        peca('financeiro', 'atendimento', 1160, -70, 'Atende o financeiro', { responsavel: 'fila-financeiro', tempo_s: 360 }),
        peca('suporte', 'atendimento', 1160, 120, 'Atende o suporte', { responsavel: 'fila-suporte-tecnico', tempo_s: 720 }),
        peca('aguardando', 'espera', 1530, 120, 'Aguardando o cliente'),
        peca('resolvido', 'fim', 1820, 20, 'Resolvido'),
        peca('protocolo', 'mensagem', 1820, 220, 'Envia protocolo por e-mail', { canal: 'email', tempo_s: 10 }),
        peca('inatividade', 'fim', 2110, 223, 'Encerrado por inatividade'),
        peca('fechado', 'mensagem', 560, 300, 'Avisa o horário de atendimento', { tempo_s: 4 }),
        peca('encerra', 'fim', 860, 303, 'Encerra a conversa'),
      ],
      [
        liga('c1', 'inicio', 'boas-vindas'),
        liga('c2', 'boas-vindas', 'horario'),
        liga('c3', 'horario', 'assunto', { regra: 'horario', horario: 'dentro' }),
        liga('c4', 'horario', 'fechado', { regra: 'horario', horario: 'fora' }),
        liga('c5', 'assunto', 'financeiro', { regra: 'opcao', valor: '1', rotulo: 'Financeiro' }),
        liga('c6', 'assunto', 'suporte', { regra: 'opcao', valor: '2', rotulo: 'Suporte' }),
        liga('c7', 'financeiro', 'resolvido'),
        liga('c8', 'suporte', 'aguardando'),
        liga('c9', 'aguardando', 'resolvido', { regra: 'condicao', valor: 'cliente confirmou' }),
        liga('c10', 'aguardando', 'protocolo', { regra: 'tempo', tempo_s: 7200 }),
        liga('c11', 'protocolo', 'inatividade'),
        liga('c12', 'fechado', 'encerra'),
      ],
      {
        grupos: [{ id: 'humano', nome: 'Atendimento humano', x: 860, y: -110, w: 600, h: 330, cor: '#dcecf8' }],
        notas: [{ id: 'nota', texto: 'Dá play no Início e escolhe os caminhos. O horário decide sozinho pela data e hora da simulação.', x: 240, y: 230, w: 190, h: 110 }],
      },
    ),
  },
  {
    chave: 'credito',
    nome: 'Esteira de crédito',
    descricao: 'Pedido, consulta de score, aprovação automática, análise manual e aviso ao cliente.',
    canal: 'interno',
    cadastros: [{ id: 'bureau', tipo: 'sistema', nome: 'Bureau de crédito' }, { id: 'analistas', tipo: 'equipe', nome: 'Analistas de crédito' }],
    documento: doc(
      [
        peca('pedido', 'inicio', 0, 70, 'Pedido de crédito criado', { canal: 'interno' }),
        peca('score', 'sistema', 260, 69, 'Consulta o score', { responsavel: 'bureau', tempo_s: 20 }),
        peca('faixa', 'decisao', 540, 30, 'Score?'),
        peca('automatico', 'etapa', 760, -60, 'Aprova automático', { tempo_s: 60 }),
        peca('analise', 'atendimento', 730, 280, 'Análise do pedido', { responsavel: 'analistas', tempo_s: 14400 }),
        peca('analista', 'decisao', 1030, 240, 'Analista aprova?'),
        peca('liberado', 'fim', 1320, -56, 'Crédito liberado'),
        peca('aviso', 'mensagem', 1300, 140, 'Avisa o cliente por e-mail', { canal: 'email', tempo_s: 30 }),
        peca('aviso-negado', 'mensagem', 1030, 480, 'Avisa a negativa por e-mail', { canal: 'email', tempo_s: 30 }),
        peca('negado', 'fim', 1320, 483, 'Pedido negado'),
      ],
      [
        liga('c1', 'pedido', 'score'),
        liga('c2', 'score', 'faixa'),
        liga('c3', 'faixa', 'automatico', { regra: 'condicao', valor: 'score ≥ 700' }),
        liga('c4', 'faixa', 'analise', { regra: 'condicao', valor: '500 a 699' }),
        liga('c5', 'faixa', 'aviso-negado', { regra: 'senao' }),
        liga('c6', 'automatico', 'aviso'),
        liga('c7', 'analise', 'analista'),
        liga('c8', 'analista', 'aviso', { regra: 'opcao', valor: 'S', rotulo: 'Aprova' }),
        liga('c9', 'analista', 'aviso-negado', { regra: 'opcao', valor: 'N', rotulo: 'Nega' }),
        liga('c10', 'aviso', 'liberado'),
        liga('c11', 'aviso-negado', 'negado'),
      ],
      { grupos: [{ id: 'manual', nome: 'Análise manual', x: 690, y: 210, w: 560, h: 250, cor: '#fbefd6' }] },
    ),
  },
  {
    chave: 'email',
    nome: 'SAC por e-mail',
    descricao: 'Resposta automática, triagem, espera pelo cliente e escalonamento pra supervisão.',
    canal: 'email',
    cadastros: [{ id: 'fila-sac', tipo: 'fila', nome: 'Fila SAC' }, { id: 'supervisao', tipo: 'equipe', nome: 'Supervisão SAC' }],
    documento: doc(
      [
        peca('chega', 'inicio', 0, 60, 'E-mail chega no SAC', { canal: 'email' }),
        peca('automatica', 'mensagem', 270, 59, 'Resposta automática com protocolo', { tempo_s: 5 }),
        peca('triagem', 'atendimento', 560, 59, 'Triagem', { responsavel: 'fila-sac', tempo_s: 7200 }),
        peca('aguardando', 'espera', 850, 59, 'Aguardando o cliente'),
        peca('resolvido', 'fim', 1140, -40, 'Resolvido'),
        peca('escala', 'atendimento', 1110, 170, 'Escala pra supervisão', { responsavel: 'supervisao', tempo_s: 3600 }),
        peca('encerrado', 'fim', 1400, 173, 'Encerrado pela supervisão'),
      ],
      [
        liga('c1', 'chega', 'automatica'),
        liga('c2', 'automatica', 'triagem'),
        liga('c3', 'triagem', 'aguardando'),
        liga('c4', 'aguardando', 'resolvido', { regra: 'condicao', valor: 'cliente confirmou a solução' }),
        liga('c5', 'aguardando', 'escala', { regra: 'tempo', tempo_s: 172800 }),
        liga('c6', 'escala', 'encerrado'),
      ],
    ),
  },
  {
    chave: 'ura',
    nome: 'URA telefônica',
    descricao: 'Ligação com horário, menu por tecla, filas e caixa postal quando ninguém atende.',
    canal: 'telefonia',
    cadastros: [HORARIO_COMERCIAL, { id: 'fila-vendas', tipo: 'fila', nome: 'Fila Vendas' }, { id: 'fila-suporte', tipo: 'fila', nome: 'Fila Suporte' }],
    documento: doc(
      [
        peca('liga', 'inicio', 0, 40, 'Cliente liga no 0800', { canal: 'telefonia' }),
        peca('horario', 'decisao', 260, 0, 'Dentro do horário?', { responsavel: 'horario-comercial' }),
        peca('menu', 'decisao', 560, -60, 'Menu principal', { tempo_s: 8, descricao: 'Digite 1 para vendas ou 2 para suporte.' }),
        peca('vendas', 'atendimento', 840, -150, 'Atende vendas', { responsavel: 'fila-vendas', tempo_s: 120 }),
        peca('suporte', 'atendimento', 840, 20, 'Atende suporte', { responsavel: 'fila-suporte', tempo_s: 240 }),
        peca('atendido', 'fim', 1180, -70, 'Atendido'),
        peca('caixa', 'mensagem', 1160, 120, 'Caixa postal', { tempo_s: 30 }),
        peca('desliga', 'fim', 1440, 300, 'Desliga'),
        peca('fechado', 'mensagem', 560, 380, 'Fora do horário', { tempo_s: 9 }),
        peca('invalida', 'mensagem', 840, 220, 'Opção inválida', { tempo_s: 4 }),
      ],
      [
        liga('c1', 'liga', 'horario'),
        liga('c2', 'horario', 'menu', { regra: 'horario', horario: 'dentro' }),
        liga('c3', 'horario', 'fechado', { regra: 'horario', horario: 'fora' }),
        liga('c4', 'menu', 'vendas', { regra: 'opcao', valor: '1', rotulo: 'Vendas' }),
        liga('c5', 'menu', 'suporte', { regra: 'opcao', valor: '2', rotulo: 'Suporte' }),
        liga('c6', 'menu', 'invalida', { regra: 'senao' }),
        liga('c7', 'vendas', 'atendido'),
        liga('c8', 'suporte', 'atendido', { regra: 'condicao', valor: 'alguém atendeu' }),
        liga('c9', 'suporte', 'caixa', { regra: 'tempo', tempo_s: 180 }),
        liga('c10', 'caixa', 'desliga'),
        liga('c11', 'fechado', 'desliga'),
        liga('c12', 'invalida', 'desliga'),
      ],
    ),
  },
]);

/**
 * O documento de um fluxo novo a partir de um modelo: uma cópia que se pode editar, com cada responsável
 * trocado pelo cadastro da empresa. `ids` leva o id local de cada cadastro do modelo ao id do cadastro da empresa.
 */
export function instanciarModelo(m: Modelo, ids: Readonly<Record<string, string>>): Documento {
  const faltam = m.cadastros.filter((k) => !Object.hasOwn(ids, k.id)).map((k) => k.nome);
  if (faltam.length) throw new Error(`Faltam os cadastros da empresa pra: ${faltam.join(', ')}.`);
  const d = structuredClone(m.documento) as Documento;
  for (const p of d.pecas) if (p.responsavel) p.responsavel = ids[p.responsavel]!;
  return d;
}
