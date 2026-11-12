import type { Canal, Documento, Expressao, Peca } from '../formato/documento';
import { existe, indexar, type Indice } from '../formato/indice';
import { lerRef } from '../formato/refs';
import { dentroDoHorario, ehFeriado, lerInicio, somar } from './relogio';

export type QuemDecide = 'quem_liga' | 'relogio' | 'sistema' | 'fila' | 'grupo' | 'ramal';
export type Motivo = 'fim' | 'atendido' | 'desistiu' | 'beco' | 'destino_inexistente' | 'ciclo' | 'saiu_da_central';
export type Como = 'cenario' | 'relogio' | 'unica' | 'resposta' | 'ninguem_atende';

export interface Opcao {
  opcao: string;
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
  | { tipo: 'correu'; de: string; para: string; opcao: string; t: number }
  | { tipo: 'terminou'; ref: string; motivo: Motivo; detalhe?: string; t: number };

type SemT<E> = E extends unknown ? Omit<E, 't'> : never;

export interface OpcoesExecucao {
  /** Por onde a ligação entra: entrada:…, ou qualquer outra referência (ramal:9004, peca:…). */
  entrada: string;
  /** Hora de parede do início, AAAA-MM-DDTHH:MM. */
  inicio: string;
  /** cenario (padrão): relógio e respostas decidem sozinhos. livre: tudo é perguntado. ninguem_atende: filas, grupos e ramais não atendem. */
  modo?: 'cenario' | 'livre' | 'ninguem_atende';
  /** Respostas por referência. Lista = uma resposta por visita. */
  respostas?: Record<string, string | readonly string[]>;
  /** Termina como ciclo quando um ponto é alcançado esta quantidade de vezes. Padrão 3; no modo livre, sem limite. */
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
  private vars: Record<string, string> = {};
  private visitas = new Map<string, number>();
  private aguardando: { ref: string; opcoes: Opcao[] } | null = null;
  private motivoFim: Motivo | null = null;

  constructor(fonte: Documento | Indice, opcoes: OpcoesExecucao) {
    this.idx = 'formato' in fonte ? indexar(fonte) : fonte;
    this.inicioMs = lerInicio(opcoes.inicio);
    this.modo = opcoes.modo ?? 'cenario';
    this.limite = opcoes.limiteVisitas ?? (this.modo === 'livre' ? Infinity : 3);
    for (const [ref, r] of Object.entries(opcoes.respostas ?? {})) this.respostas.set(ref, typeof r === 'string' ? [r] : [...r]);
    this.atual = opcoes.entrada;
  }

  get terminou(): boolean {
    return this.motivoFim !== null;
  }
  get motivo(): Motivo | null {
    return this.motivoFim;
  }
  /** A decisão esperando resposta, se houver. */
  get pendente(): { ref: string; opcoes: Opcao[] } | null {
    return this.aguardando;
  }
  get variaveis(): Record<string, string> {
    return { ...this.vars };
  }
  get segundos(): number {
    return this.t;
  }
  relogio(t: number = this.t): number {
    return somar(this.inicioMs, t);
  }

  /** Anda até terminar ou parar numa decisão sem resposta. Devolve os eventos novos. */
  avancar(resposta?: string): Evento[] {
    const inicio = this.eventos.length;
    if (this.aguardando) {
      if (resposta === undefined) return [];
      const o = this.aguardando.opcoes.find((x) => x.opcao === resposta && x.disponivel);
      if (!o) throw new Error(`"${resposta}" não é uma opção disponível em ${this.aguardando.ref}`);
      const ref = this.aguardando.ref;
      this.aguardando = null;
      this.emitir({ tipo: 'escolheu', ref, opcao: o.opcao, como: 'resposta' });
      this.aplicar(ref, o);
    }
    for (let guarda = 0; !this.motivoFim && !this.aguardando; guarda++) {
      if (guarda > 10_000) throw new Error('a execução não terminou em 10.000 passos');
      this.passo();
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

  private seguir(de: string, para: string, opcao: string): void {
    this.emitir({ tipo: 'correu', de, para, opcao });
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
    if (quem === null) return this.aplicar(ref, opcoes[0]!);

    const disponiveis = opcoes.filter((o) => o.disponivel);
    const auto = this.respostaAutomatica(ref, disponiveis, opcoes.length);
    const sugestao = this.respostaDoRelogio(ref);
    this.emitir(sugestao ? { tipo: 'decisao', ref, quem, opcoes, sugestao } : { tipo: 'decisao', ref, quem, opcoes });
    if (!auto) {
      this.aguardando = { ref, opcoes };
      return;
    }
    const o = disponiveis.find((x) => x.opcao === auto.opcao);
    if (!o) return this.terminar(ref, 'beco', `não existe saída "${auto.opcao}"`);
    this.emitir({ tipo: 'escolheu', ref, opcao: o.opcao, como: auto.como });
    this.aplicar(ref, o);
  }

  private aplicar(ref: string, o: Opcao): void {
    this.t += o.segundos;
    if (o.define) {
      this.vars[o.define.chave] = o.define.valor;
      this.emitir({ tipo: 'definiu', ref, chave: o.define.chave, valor: o.define.valor });
    }
    if (o.termina) return this.terminar(ref, o.termina);
    if (!o.para) return this.terminar(ref, 'beco', `"${o.rotulo}" não leva a lugar nenhum`);
    this.seguir(ref, o.para, o.opcao);
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
        const o: Opcao = {
          opcao: s.opcao,
          rotulo: s.rotulo ?? s.opcao,
          para: s.para,
          disponivel: !s.quando || this.vars[s.quando.chave] === undefined || this.vars[s.quando.chave] === s.quando.valor,
          segundos: p.tipo === 'menu' ? (s.opcao === 'esgotou' ? (p.espera_s ?? 5) * (p.tentativas ?? 1) : 3) : 0,
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
          ? { opcao: 'nao_atende', rotulo: `Ninguém atende em ${espera} s`, para: f.ao_esgotar ?? 'fim:desliga', disponivel: true, segundos: espera }
          : { opcao: 'nao_atende', rotulo: 'Ninguém atende e a fila não tem tempo máximo', termina: 'desistiu', disponivel: true, segundos: 180, exemplo: true },
      ];
    }
    if (r.tipo === 'grupo') {
      const g = this.idx.grupos.get(r.id)!;
      const toque = g.toque_s ?? 20;
      return [
        { opcao: 'atende', rotulo: 'Alguém atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 10), exemplo: true },
        { opcao: 'nao_atende', rotulo: `Ninguém atende em ${toque} s`, para: g.ao_esgotar, disponivel: true, segundos: toque },
      ];
    }
    if (r.tipo === 'ramal') {
      const x = this.idx.ramais.get(r.id)!;
      const toque = x.siga_me_so_ramal_s !== undefined && x.siga_me_com_lista_s !== undefined ? x.siga_me_so_ramal_s + x.siga_me_com_lista_s : (x.toque_s ?? 20);
      return [
        { opcao: 'atende', rotulo: 'Atende', termina: 'atendido', disponivel: true, segundos: Math.min(toque, 8), exemplo: true },
        { opcao: 'nao_atende', rotulo: `Não atende em ${toque} s`, para: x.ao_nao_atender, disponivel: true, segundos: toque },
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

  private respostaAutomatica(ref: string, disponiveis: Opcao[], total: number): { opcao: string; como: Como } | null {
    const fila = this.respostas.get(ref);
    if (fila && fila.length > 0) {
      const opcao = fila.shift()!;
      if (disponiveis.some((o) => o.opcao === opcao)) return { opcao, como: 'cenario' };
    }
    if (this.modo !== 'livre') {
      const doRelogio = this.respostaDoRelogio(ref);
      if (doRelogio) return { opcao: doRelogio, como: 'relogio' };
    }
    const tipo = lerRef(ref)?.tipo;
    if (this.modo === 'ninguem_atende' && (tipo === 'fila' || tipo === 'grupo' || tipo === 'ramal')) return { opcao: 'nao_atende', como: 'ninguem_atende' };
    if (disponiveis.length === 1 && total > 1) return { opcao: disponiveis[0]!.opcao, como: 'unica' };
    return null;
  }
}

/** Cria a execução e anda até terminar ou parar numa decisão. */
export function executar(fonte: Documento | Indice, opcoes: OpcoesExecucao): Execucao {
  const e = new Execucao(fonte, opcoes);
  e.avancar();
  return e;
}
