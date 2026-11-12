import { completude, regrasDeRelogioIncompletas } from '../formato/completude';
import type { Canal, Documento, Expressao, Peca } from '../formato/documento';
import { existe, indexar, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { dentroDoHorario, ehFeriado, lerInicio, somar } from './relogio';

export type QuemDecide = 'quem_liga' | 'relogio' | 'sistema' | 'fila' | 'grupo' | 'ramal';
export type Motivo = 'fim' | 'atendido' | 'desistiu' | 'beco' | 'destino_inexistente' | 'ciclo' | 'saiu_da_central' | 'incompleta';
export type Como = 'cenario' | 'relogio' | 'unica' | 'resposta' | 'ninguem_atende';

export interface Opcao {
  opcao: string;
  /** Id da saída (aba saidas), quando a opção vem de uma peça. Distingue saídas com a mesma opção e "quando" diferente. */
  saida?: string;
  rotulo: string;
  /** Pra onde leva. Sem para e sem termina = beco sem saída. */
  para?: string;
  termina?: 'atendido' | 'desistiu';
  /** false quando a condição "quando" não bate com as variáveis. */
  disponivel: boolean;
  /** Tempo que a escolha consome. */
  segundos: number;
  /** O tempo é um exemplo, não vem da central. */
  exemplo?: boolean;
  define?: Expressao;
}

export type Evento =
  | { tipo: 'chegou'; ref: string; visita: number; t: number }
  | { tipo: 'trocou_canal'; ref: string; de: Canal; para: Canal; t: number }
  | { tipo: 'decisao'; ref: string; quem: QuemDecide; opcoes: Opcao[]; sugestao?: string; t: number }
  | { tipo: 'escolheu'; ref: string; opcao: string; como: Como; t: number }
  | { tipo: 'definiu'; ref: string; chave: string; valor: string; t: number }
  | { tipo: 'correu'; de: string; para: string; opcao: string; saida?: string; t: number }
  | { tipo: 'resposta_ignorada'; ref: string; resposta: string; motivo: string; t: number }
  | { tipo: 'terminou'; ref: string; motivo: Motivo; detalhe?: string; t: number };

type SemT<E> = E extends unknown ? Omit<E, 't'> : never;

export interface OpcoesExecucao {
  /** Por onde a ligação entra: entrada:…, ou qualquer outra referência (ramal:9004, peca:…). */
  entrada: string;
  /** Hora de parede do início, AAAA-MM-DDTHH:MM. */
  inicio: string;
  /** cenario (padrão): relógio e respostas decidem sozinhos. livre: tudo é perguntado. ninguem_atende: filas, grupos e ramais não atendem. */
  modo?: 'cenario' | 'livre' | 'ninguem_atende';
  /**
   * Respostas por referência: o id da saída ou a opção. Lista = uma resposta por visita.
   * Resposta que não serve (não existe, não vale ou é ambígua) vira o evento resposta_ignorada.
   */
  respostas?: Record<string, string | readonly string[]>;
  /**
   * Termina como ciclo quando um ponto é alcançado esta quantidade de vezes. Padrão 3; no modo livre, sem limite.
   * Só conta a repetição automática: uma escolha de quem liga ou do cenário zera a contagem.
   */
  limiteVisitas?: number;
}

export class Execucao {
  readonly eventos: Evento[] = [];
  readonly inicioMs: number;
  private readonly idx: Indice;
  private readonly modo: 'cenario' | 'livre' | 'ninguem_atende';
  private readonly limite: number;
  private readonly respostas = new Map<string, string[]>();
  private atual: string;
  private t = 0;
  private canal: Canal = 'telefonia';
  private readonly vars = new Map<string, string>();
  private visitas = new Map<string, number>();
  private aguardando: { ref: string; opcoes: Opcao[] } | null = null;
  private motivoFim: Motivo | null = null;
  /** O que falta em cada ponto que não dá pra simular. */
  private readonly incompletas = new Map<string, string>();

  constructor(fonte: Documento | Indice, opcoes: OpcoesExecucao) {
    this.idx = 'formato' in fonte ? indexar(fonte) : fonte;
    this.inicioMs = lerInicio(opcoes.inicio);
    this.modo = opcoes.modo ?? 'cenario';
    this.limite = opcoes.limiteVisitas ?? (this.modo === 'livre' ? Infinity : 3);
    for (const [ref, r] of Object.entries(opcoes.respostas ?? {})) this.respostas.set(ref, typeof r === 'string' ? [r] : [...r]);
    this.atual = opcoes.entrada;
    this.apontarIncompletas();
  }

  private apontarIncompletas(): void {
    for (const p of completude(this.idx)) {
      if (p.regra !== 'menu_sem_esgotou' && !this.incompletas.has(p.ref)) this.incompletas.set(p.ref, p.mensagem);
    }
    for (const p of regrasDeRelogioIncompletas(this.idx)) this.incompletas.set(p.ref, p.mensagem);
  }

  get terminou(): boolean {
    return this.motivoFim !== null;
  }
  get motivo(): Motivo | null {
    return this.motivoFim;
  }
  /** A decisão esperando resposta, se houver. */
  get pendente(): { ref: string; opcoes: Opcao[] } | null {
    return this.aguardando && { ref: this.aguardando.ref, opcoes: this.aguardando.opcoes.map(copiar) };
  }
  get variaveis(): Record<string, string> {
    return Object.fromEntries(this.vars);
  }
  get segundos(): number {
    return this.t;
  }
  relogio(t: number = this.t): number {
    return somar(this.inicioMs, t);
  }

  /** Anda até terminar ou parar numa decisão sem resposta. A resposta é o id da saída ou a opção. Devolve os eventos novos. */
  avancar(resposta?: string): Evento[] {
    const inicio = this.eventos.length;
    if (this.aguardando) {
      if (resposta === undefined) return [];
      const ref = this.aguardando.ref;
      const o = escolher(ref, this.aguardando.opcoes, resposta);
      if (typeof o === 'string') throw new Error(o);
      this.aguardando = null;
      this.emitir({ tipo: 'escolheu', ref, opcao: o.opcao, como: 'resposta' });
      this.visitas.clear();
      this.aplicar(ref, o);
    }
    for (let guarda = 0; !this.motivoFim && !this.aguardando; guarda++) {
      if (guarda >= 10_000) this.terminar(this.atual, 'ciclo', 'a ligação ficou girando sem nenhuma decisão');
      else this.passo();
    }
    return this.eventos.slice(inicio);
  }

  private emitir(e: SemT<Evento>): void {
    this.eventos.push({ ...e, t: this.t } as Evento);
  }

  private terminar(ref: string, motivo: Motivo, detalhe?: string): void {
    this.motivoFim = motivo;
    this.emitir(detalhe ? { tipo: 'terminou', ref, motivo, detalhe } : { tipo: 'terminou', ref, motivo });
  }

  private seguir(de: string, para: string, opcao: string, saida?: string): void {
    this.emitir(saida === undefined ? { tipo: 'correu', de, para, opcao } : { tipo: 'correu', de, para, opcao, saida });
    this.atual = para;
  }

  private passo(): void {
    const ref = this.atual;
    const visita = (this.visitas.get(ref) ?? 0) + 1;
    this.visitas.set(ref, visita);
    this.emitir({ tipo: 'chegou', ref, visita });
    if (visita >= this.limite) return this.terminar(ref, 'ciclo', `${ref} recebeu a ligação ${visita} vezes`);
    if (ref === 'fim:atendido') return this.terminar(ref, 'atendido');
    if (ref.startsWith('fim:')) return this.terminar(ref, 'fim');
    if (ref.startsWith('externo:')) return this.terminar(ref, 'saiu_da_central');
    if (!existe(this.idx, ref)) return this.terminar(ref, 'destino_inexistente');
    const falta = this.incompletas.get(ref);
    if (falta) return this.terminar(ref, 'incompleta', falta);

    const r = lerRef(ref)!;
    if (r.tipo === 'entrada') {
      const e = this.idx.entradas.get(r.id)!;
      this.canal = e.canal;
      return this.seguir(ref, e.destino, 'sempre');
    }
    if (r.tipo === 'peca') {
      const p = this.idx.pecas.get(r.id)!;
      if (p.canal && p.canal !== this.canal) {
        this.emitir({ tipo: 'trocou_canal', ref, de: this.canal, para: p.canal });
        this.canal = p.canal;
      }
      if (p.tipo === 'fim') return this.terminar(ref, 'fim');
      this.t += p.duracao_s ?? 0;
    }

    const opcoes = this.opcoesDe(ref);
    if (opcoes.length === 0) return this.terminar(ref, 'beco');
    const quem = this.quemDecide(ref);
    if (quem === null) {
      const unica = opcoes.find((o) => o.disponivel);
      if (!unica) return this.terminar(ref, 'beco', `a saída "${opcoes[0]!.rotulo}" não vale com as variáveis atuais`);
      return this.aplicar(ref, unica);
    }

    if (!opcoes.some((o) => o.disponivel)) return this.terminar(ref, 'beco', 'nenhuma saída vale com as variáveis atuais');
    const sugestao = this.respostaDoRelogio(ref);
    const copias = opcoes.map(copiar);
    this.emitir(sugestao ? { tipo: 'decisao', ref, quem, opcoes: copias, sugestao } : { tipo: 'decisao', ref, quem, opcoes: copias });
    const auto = this.respostaAutomatica(ref, opcoes, sugestao);
    if (!auto) {
      this.aguardando = { ref, opcoes };
      return;
    }
    if (typeof auto.o === 'string') return this.terminar(ref, 'beco', auto.o);
    this.emitir({ tipo: 'escolheu', ref, opcao: auto.o.opcao, como: auto.como });
    // O cenário escolheu: o que vier depois não é repetição automática.
    if (auto.como === 'cenario') this.visitas.clear();
    this.aplicar(ref, auto.o);
  }

  private aplicar(ref: string, o: Opcao): void {
    this.t += o.segundos;
    if (o.define) {
      this.vars.set(o.define.chave, o.define.valor);
      this.emitir({ tipo: 'definiu', ref, chave: o.define.chave, valor: o.define.valor });
    }
    if (o.termina) return this.terminar(ref, o.termina);
    if (!o.para) return this.terminar(ref, 'beco', `"${o.rotulo}" não leva a lugar nenhum`);
    this.seguir(ref, o.para, o.opcao, o.saida);
  }

  private quemDecide(ref: string): QuemDecide | null {
    const r = lerRef(ref)!;
    if (r.tipo === 'fila' || r.tipo === 'grupo' || r.tipo === 'ramal') return r.tipo;
    if (r.tipo !== 'peca') return null;
    const p = this.idx.pecas.get(r.id)!;
    if (p.tipo === 'menu') return 'quem_liga';
    if (p.tipo === 'regra_horario' || p.tipo === 'regra_feriado') return 'relogio';
    return (this.idx.saidasDe.get(r.id)?.length ?? 0) > 1 ? 'sistema' : null;
  }

  private opcoesDe(ref: string): Opcao[] {
    const r = lerRef(ref)!;
    if (r.tipo === 'peca') {
      const p = this.idx.pecas.get(r.id)!;
      return (this.idx.saidasDe.get(r.id) ?? []).map((s) => {
        const valor = s.quando && this.vars.get(s.quando.chave);
        const o: Opcao = {
          opcao: s.opcao,
          saida: s.id,
          rotulo: s.rotulo ?? s.opcao,
          para: s.para,
          disponivel: !s.quando || valor === undefined || valor === s.quando.valor,
          // Menu sem espera_s ou tentativas para antes, como incompleto.
          segundos: p.tipo === 'menu' ? (s.opcao === 'esgotou' ? p.espera_s! * p.tentativas! : 3) : 0,
        };
        if (s.define) o.define = s.define;
        return o;
      });
    }
    if (r.tipo === 'fila') {
      const f = this.idx.filas.get(r.id)!;
      const espera = f.espera_maxima_s;
      return [
        { opcao: 'atende', rotulo: 'Alguém atende', termina: 'atendido', disponivel: true, segundos: 30, exemplo: true },
        espera !== undefined
          ? { opcao: 'nao_atende', rotulo: rotuloSemTransbordo(`Ninguém atende em ${espera} s`, f.ao_esgotar), para: f.ao_esgotar ?? 'fim:desliga', disponivel: true, segundos: espera }
          : { opcao: 'nao_atende', rotulo: 'Ninguém atende e a fila não tem tempo máximo', termina: 'desistiu', disponivel: true, segundos: 180, exemplo: true },
      ];
    }
    if (r.tipo === 'grupo') {
      const g = this.idx.grupos.get(r.id)!;
      const toque = g.toque_s ?? 20;
      return [
        { opcao: 'atende', rotulo: 'Alguém atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 10), exemplo: true },
        { opcao: 'nao_atende', rotulo: rotuloSemTransbordo(`Ninguém atende em ${toque} s`, g.ao_esgotar), para: g.ao_esgotar ?? 'fim:desliga', disponivel: true, segundos: toque },
      ];
    }
    if (r.tipo === 'ramal') {
      const x = this.idx.ramais.get(r.id)!;
      const toque = x.siga_me_so_ramal_s !== undefined && x.siga_me_com_lista_s !== undefined ? x.siga_me_so_ramal_s + x.siga_me_com_lista_s : (x.toque_s ?? 20);
      return [
        { opcao: 'atende', rotulo: 'Atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 8), exemplo: true },
        { opcao: 'nao_atende', rotulo: rotuloSemTransbordo(`Não atende em ${toque} s`, x.ao_nao_atender), para: x.ao_nao_atender ?? 'fim:desliga', disponivel: true, segundos: toque },
      ];
    }
    return [];
  }

  private respostaDoRelogio(ref: string): string | undefined {
    const r = lerRef(ref);
    if (r?.tipo !== 'peca') return undefined;
    const p: Peca | undefined = this.idx.pecas.get(r.id);
    const agora = this.relogio();
    if (p?.tipo === 'regra_horario') {
      const grupo = p.horario ? lerRef(p.horario)?.id : undefined;
      return dentroDoHorario(this.idx.janelas.get(grupo ?? '') ?? [], agora) ? 'sim' : 'nao';
    }
    if (p?.tipo === 'regra_feriado') return ehFeriado(this.idx.feriados.get(p.calendario ?? '') ?? [], agora) ? 'sim' : 'nao';
    return undefined;
  }

  /**
   * Quem responde sozinho: o cenário, o relógio, o modo "ninguém atende" ou a única saída que vale.
   * Resposta do cenário que não serve é avisada e descartada. Uma string em `o` é o motivo do beco.
   */
  private respostaAutomatica(ref: string, opcoes: Opcao[], doRelogio: string | undefined): { o: Opcao | string; como: Como } | null {
    const fila = this.respostas.get(ref);
    if (fila && fila.length > 0) {
      const resposta = fila.shift()!;
      const o = escolher(ref, opcoes, resposta);
      if (typeof o !== 'string') return { o, como: 'cenario' };
      this.emitir({ tipo: 'resposta_ignorada', ref, resposta, motivo: o });
    }
    if (this.modo !== 'livre' && doRelogio) {
      const candidatas = candidatasDe(opcoes, doRelogio);
      if (candidatas.length === 0) return { o: `não existe saída "${doRelogio}"`, como: 'relogio' };
      // Mais de uma saída com a mesma resposta do relógio: quem decide é quem simula.
      if (candidatas.length === 1) return { o: candidatas[0]!, como: 'relogio' };
    }
    const tipo = lerRef(ref)?.tipo;
    if (this.modo === 'ninguem_atende' && (tipo === 'fila' || tipo === 'grupo' || tipo === 'ramal')) {
      return { o: opcoes.find((x) => x.opcao === 'nao_atende')!, como: 'ninguem_atende' };
    }
    const disponiveis = opcoes.filter((x) => x.disponivel);
    if (disponiveis.length === 1 && opcoes.length > 1) return { o: disponiveis[0]!, como: 'unica' };
    return null;
  }
}

/** "Ninguém atende em 20 s: desliga (sem transbordo)" quando não há destino configurado. */
const rotuloSemTransbordo = (rotulo: string, destino: string | undefined) => (destino === undefined ? `${rotulo}: desliga (sem transbordo)` : rotulo);

function copiar(o: Opcao): Opcao {
  return o.define ? { ...o, define: { ...o.define } } : { ...o };
}

/** Opções disponíveis que a resposta indica: primeiro pelo id exato da saída, depois pela opção. */
function candidatasDe(opcoes: Opcao[], resposta: string): Opcao[] {
  const disponiveis = opcoes.filter((o) => o.disponivel);
  const porId = disponiveis.find((o) => o.saida === resposta);
  return porId ? [porId] : disponiveis.filter((o) => o.opcao === resposta);
}

/** A opção que a resposta indica, ou o motivo de não servir. */
function escolher(ref: string, opcoes: Opcao[], resposta: string): Opcao | string {
  const candidatas = candidatasDe(opcoes, resposta);
  if (candidatas.length === 1) return candidatas[0]!;
  if (candidatas.length === 0) return `"${resposta}" não é uma opção disponível em ${ref}`;
  return `"${resposta}" vale pra mais de uma saída em ${ref} (${candidatas.map((o) => o.saida).join(', ')}): responda com o id da saída`;
}

/** Cria a execução e anda até terminar ou parar numa decisão. */
export function executar(fonte: Documento | Indice, opcoes: OpcoesExecucao): Execucao {
  const e = new Execucao(fonte, opcoes);
  e.avancar();
  return e;
}
