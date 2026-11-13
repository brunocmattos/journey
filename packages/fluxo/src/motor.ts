import { camposHorario, type Cadastro } from './cadastros';
import { indexar, textoRegra, type Indice } from './indice';
import { dentroDoHorario, lerQuando } from './relogio';
import type { Conexao, Documento, Regra } from './documento';

/** O que o motor sabe da empresa: os cadastros (pros horários) e o canal do fluxo. */
export interface Contexto {
  cadastros?: readonly Cadastro[];
  /** O canal em que a água começa, quando o Início não diz. */
  canal?: string;
}

/**
 * - relogio: decisões com saídas de horário são decididas pelo relógio (precisa de `quando`); o resto pergunta.
 * - livre: tudo pergunta; a escolha do relógio vem marcada como sugerida.
 */
export type Modo = 'relogio' | 'livre';

export interface OpcoesExecucao {
  /** Id da peça onde a água começa (normalmente um Início). */
  inicio: string;
  /** Data e hora simuladas do começo, AAAA-MM-DDTHH:MM. Sem ela, o relógio não decide. */
  quando?: string;
  modo?: Modo;
}

export interface Opcao {
  conexao: string;
  para: string;
  /** O que a opção diz: o texto da regra, ou o nome do destino. */
  texto: string;
  regra: Regra;
  /** Quanto o relógio anda se for por aqui (regra tempo). */
  tempo_s: number;
  /** No modo livre: o que o relógio escolheria. */
  sugerida: boolean;
}

export type QuemEscolheu = 'unica' | 'pessoa' | 'relogio';
/**
 * - fim: chegou num Fim.
 * - beco: não tem pra onde ir (peça sem saída, ou o relógio decidiu um lado que não tem saída).
 * - ciclo: andando sozinho, chegou pela terceira vez na mesma peça.
 * - limite: andou sozinho mais passos do que um fluxo de verdade dá (trava de segurança).
 * - inexistente: o começo não existe.
 */
export type MotivoFim = 'fim' | 'beco' | 'ciclo' | 'limite' | 'inexistente';

export type Evento =
  | { tipo: 'chegou'; peca: string; canal: string | null; relogio_s: number }
  | { tipo: 'pede_escolha'; peca: string; opcoes: Opcao[] }
  | { tipo: 'escolheu'; peca: string; conexao: string; quem: QuemEscolheu }
  | { tipo: 'correu'; conexao: string; de: string; para: string; relogio_s: number }
  | { tipo: 'escolha_ignorada'; resposta: string }
  | { tipo: 'terminou'; motivo: MotivoFim; peca: string | null; relogio_s: number };

/** Chegar pela terceira vez na mesma peça sem ninguém escolher no meio é ciclo sem fim. */
const VOLTAS_MAXIMAS = 3;
/** Trava de segurança: passos andando sozinho entre duas escolhas de uma pessoa. */
const PASSOS_MAXIMOS = 10_000;

/**
 * Uma simulação. Previsível: o mesmo documento, o mesmo começo e as mesmas escolhas dão os mesmos eventos.
 * Anda sozinha enquanto há uma saída só (ou o relógio decide) e para quando precisa de uma escolha (`pendente`).
 * O documento é lido uma vez, no começo: mudar o documento depois não muda esta simulação.
 */
export class Execucao {
  readonly eventos: Evento[] = [];
  /** As escolhas aceitas até agora, em ordem (ids de conexão). É o que um cenário guarda, e "voltar" tira a última. */
  readonly escolhas: string[] = [];
  pendente: { peca: string; opcoes: Opcao[] } | null = null;
  terminou = false;
  relogio_s = 0;
  canal: string | null;

  private readonly idx: Indice;
  private readonly cadastros: Map<string, Cadastro>;
  private readonly inicioMs: number | null;
  private readonly modo: Modo;
  private readonly visitas = new Map<string, number>();
  /** Hora simulada da última vez que o relógio decidiu em cada peça. */
  private readonly horaDoRelogio = new Map<string, number>();
  private passos = 0;

  constructor(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao) {
    this.idx = indexar(doc);
    this.cadastros = new Map((contexto.cadastros ?? []).map((c) => [c.id, c]));
    this.inicioMs = opcoes.quando ? lerQuando(opcoes.quando) : null;
    this.modo = opcoes.modo ?? 'relogio';
    this.canal = contexto.canal ?? null;
    if (!this.idx.pecas.has(opcoes.inicio)) this.terminar('inexistente', null);
    else this.andar(opcoes.inicio);
  }

  /**
   * Responde a escolha pendente com o id de uma conexão e devolve os eventos novos.
   * Resposta que não é uma das opções volta como `escolha_ignorada` e não muda nada (nem entra em `eventos`).
   */
  avancar(conexao: string): Evento[] {
    const pend = this.pendente;
    const escolhida = pend && this.idx.saidas.get(pend.peca)!.find((c) => c.id === conexao);
    if (this.terminou || !pend || !escolhida || !pend.opcoes.some((o) => o.conexao === conexao)) {
      return [{ tipo: 'escolha_ignorada', resposta: conexao }];
    }
    const antes = this.eventos.length;
    this.pendente = null;
    this.escolhas.push(conexao);
    // Depois de uma escolha, a contagem de voltas e de passos recomeça: só caminho que anda sozinho vira ciclo.
    this.visitas.clear();
    this.passos = 0;
    this.eventos.push({ tipo: 'escolheu', peca: pend.peca, conexao, quem: 'pessoa' });
    this.andar(this.correr(escolhida));
    return this.eventos.slice(antes);
  }

  private terminar(motivo: MotivoFim, peca: string | null): null {
    this.terminou = true;
    this.pendente = null;
    this.eventos.push({ tipo: 'terminou', motivo, peca, relogio_s: this.relogio_s });
    return null;
  }

  /** Anda de peça em peça enquanto não precisa de escolha. Em laço, não em recursão: fluxo comprido não estoura a pilha. */
  private andar(primeira: string) {
    let id: string | null = primeira;
    while (id !== null) id = this.chegar(id);
  }

  /** Chega numa peça. Devolve a próxima peça, se segue sozinho; null se terminou ou se pede escolha. */
  private chegar(id: string): string | null {
    const p = this.idx.pecas.get(id)!;
    const voltas = (this.visitas.get(id) ?? 0) + 1;
    this.visitas.set(id, voltas);
    if (p.canal) this.canal = p.canal;
    this.eventos.push({ tipo: 'chegou', peca: id, canal: this.canal, relogio_s: this.relogio_s });
    if (voltas >= VOLTAS_MAXIMAS) return this.terminar('ciclo', id);
    if (++this.passos > PASSOS_MAXIMOS) return this.terminar('limite', id);
    this.relogio_s += p.tempo_s ?? 0;
    if (p.tipo === 'fim') return this.terminar('fim', id);
    const saidas = this.idx.saidas.get(id)!;
    if (saidas.length === 0) return this.terminar('beco', id);
    const doRelogio = this.escolhaDoRelogio(id, saidas);
    if (doRelogio !== undefined && this.modo === 'relogio') {
      if (!doRelogio) return this.terminar('beco', id);
      // "Fechado, espera e tenta de novo": se o tempo andou desde a última decisão aqui, voltar não é ciclo.
      const antes = this.horaDoRelogio.get(id);
      if (antes !== undefined && this.relogio_s > antes) this.visitas.clear();
      this.horaDoRelogio.set(id, this.relogio_s);
      this.eventos.push({ tipo: 'escolheu', peca: id, conexao: doRelogio.id, quem: 'relogio' });
      return this.correr(doRelogio);
    }
    if (saidas.length === 1) {
      this.eventos.push({ tipo: 'escolheu', peca: id, conexao: saidas[0]!.id, quem: 'unica' });
      return this.correr(saidas[0]!);
    }
    const opcoes: Opcao[] = saidas.map((c) => ({
      conexao: c.id,
      para: c.para,
      texto: textoRegra(c) || this.idx.pecas.get(c.para)!.nome,
      regra: c.regra,
      tempo_s: c.regra === 'tempo' ? (c.tempo_s ?? 0) : 0,
      sugerida: doRelogio?.id === c.id,
    }));
    this.pendente = { peca: id, opcoes: [...opcoes] };
    this.eventos.push({ tipo: 'pede_escolha', peca: id, opcoes });
    return null;
  }

  /**
   * A saída que o relógio escolhe, com a hora simulada e o Horário do responsável da peça.
   * undefined: o relógio não decide aqui (sem hora, sem Horário, ou a peça tem saídas que não são de horário).
   * null: decide, mas o lado da hora não tem saída (nem "senão").
   */
  private escolhaDoRelogio(id: string, saidas: Conexao[]): Conexao | null | undefined {
    if (this.inicioMs === null || !saidas.some((c) => c.regra === 'horario')) return undefined;
    if (!saidas.every((c) => c.regra === 'horario' || c.regra === 'senao')) return undefined;
    const horario = camposHorario(this.cadastros.get(this.idx.pecas.get(id)!.responsavel ?? ''));
    if (!horario) return undefined;
    const lado = dentroDoHorario(horario, this.inicioMs + this.relogio_s * 1000) ? 'dentro' : 'fora';
    return saidas.find((c) => c.regra === 'horario' && c.horario === lado) ?? saidas.find((c) => c.regra === 'senao') ?? null;
  }

  /** Passa por uma conexão e devolve a peça onde ela chega. */
  private correr(c: Conexao): string {
    if (c.regra === 'tempo') this.relogio_s += c.tempo_s ?? 0;
    this.eventos.push({ tipo: 'correu', conexao: c.id, de: c.de, para: c.para, relogio_s: this.relogio_s });
    return c.para;
  }
}

export function executar(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao): Execucao {
  return new Execucao(doc, contexto, opcoes);
}

/**
 * Refaz uma simulação a partir das escolhas (ids de conexão), em ordem. É assim que cenário, voltar e link refazem o caminho.
 * Para na primeira escolha que não serve mais (o fluxo mudou): `escolhas.length` diz até onde o caminho guardado valeu.
 */
export function simular(doc: Documento, contexto: Contexto, opcoes: OpcoesExecucao & { escolhas?: readonly string[] }): Execucao {
  const e = executar(doc, contexto, opcoes);
  for (const c of opcoes.escolhas ?? []) {
    if (e.avancar(c)[0]?.tipo === 'escolha_ignorada') break;
  }
  return e;
}
