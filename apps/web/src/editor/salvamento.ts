import type { Documento } from '@journey/fluxo';
import type { Estilo } from './estilo';

/** O que o banco respondeu a um salvamento. */
export type Resposta =
  | { ok: true; revisao: number }
  /**
   * conflito: outra pessoa salvou no meio (40001); trava: outra pessoa pegou a trava (P0001); rede: não chegou ou
   * deu um erro passageiro (tenta de novo); sessao: o login venceu (tenta de novo até a pessoa entrar outra vez).
   */
  | { ok: false; motivo: 'conflito' | 'trava' | 'rede' | 'sessao' | 'recusado'; mensagem?: string };

export type Situacao = 'salvo' | 'esperando' | 'salvando' | 'sem_rede' | 'sem_sessao' | 'conflito' | 'sem_trava' | 'recusado';

/** O que fica no navegador enquanto uma mudança não chegou no banco: o documento e a revisão de onde ele partiu. */
export interface CopiaLocal {
  revisao: number;
  documento: Documento;
  estilo: Estilo;
}

/** O que o banco tem agora (pra saber se um envio que ficou sem resposta chegou). */
export interface NoBanco {
  revisao: number;
  documento: unknown;
  estilo: unknown;
}

export interface OpcoesSalvamento {
  revisao: number;
  /** Manda pro banco. `sinal` aborta quando passa do `limite`. */
  enviar: (revisao: number, documento: Documento, estilo: Estilo, sinal: AbortSignal) => Promise<Resposta>;
  /** Lê a revisão, o documento e o estilo do banco; sem isso, um conflito depois de falta de rede para tudo. */
  ler?: () => Promise<NoBanco | null>;
  aoMudar: (s: Situacao, mensagem?: string) => void;
  guardar: (copia: CopiaLocal | null) => void;
  /** Quanto espera depois da última mudança (padrão 500 ms). */
  espera?: number;
  /** Quanto espera a resposta de um envio antes de desistir dele (padrão 20 s). */
  limite?: number;
}

/** Espera entre tentativas sem rede: 2 s, 4 s, 8 s… até 30 s. */
export const proximaTentativa = (n: number): number => Math.min(30_000, 2000 * 2 ** n);

type Versao = { documento: Documento; estilo: Estilo };

/**
 * Salvamento automático: espera a pessoa parar de mexer, manda o documento inteiro com a revisão que tem e,
 * se mudou de novo enquanto mandava, manda outra vez. Um envio por vez, e a cópia fica no navegador até o banco
 * confirmar. Sem rede (ou sessão vencida), tenta de novo; conflito, trava perdida ou recusa param (a tela explica).
 */
export class Salvamento {
  revisao: number;
  private pendente: Versao | null = null;
  private voo: Promise<boolean> | null = null;
  private parado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tentativas = 0;
  /** Versões mandadas desde a última confirmação que ficaram sem resposta: podem ter chegado (ver `conferir`). */
  private semResposta: Versao[] = [];
  private readonly o: OpcoesSalvamento;

  constructor(o: OpcoesSalvamento) {
    this.o = o;
    this.revisao = o.revisao;
  }

  /** Tem mudança que ainda não chegou no banco? */
  get sujo(): boolean {
    return this.pendente !== null || this.voo !== null;
  }

  mudou(documento: Documento, estilo: Estilo): void {
    this.pendente = { documento, estilo };
    // Parado, a mudança fica na fila (sem barulho na tela) e vai se alguém chamar `retomar`.
    if (this.parado) return;
    if (!this.voo) this.o.aoMudar('esperando');
    this.agendar(this.o.espera ?? 500);
  }

  /** Manda já o que estiver pendente e espera tudo chegar (ou falhar). Ao sair da página, por exemplo. */
  async agora(): Promise<void> {
    while (!this.parado && (this.voo || this.pendente)) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (!(await (this.voo ?? this.enviar()))) return;
    }
  }

  /** Para de mandar. O que estiver no ar termina, mas não agenda mais nada. */
  parar(): void {
    this.parado = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Volta a mandar depois de um `parar` (por exemplo, apagar o fluxo deu errado). */
  retomar(): void {
    this.parado = false;
    if (this.pendente) {
      this.o.aoMudar('esperando');
      this.agendar(0);
    } else if (!this.voo) this.o.aoMudar('salvo');
  }

  private agendar(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enviar();
    }, ms);
  }

  private enviar(): Promise<boolean> {
    if (this.voo) return this.voo;
    if (this.parado || !this.pendente) return Promise.resolve(true);
    this.voo = this.mandar().finally(() => (this.voo = null));
    return this.voo;
  }

  /** Um envio. Devolve se chegou. */
  private async mandar(): Promise<boolean> {
    const atual = this.pendente!;
    this.pendente = null;
    this.o.aoMudar('salvando');
    // Enquanto o banco não confirma, a cópia fica no navegador (aba fechada ou pedido que nunca volta).
    this.o.guardar({ revisao: this.revisao, ...atual });
    let r = await this.tentar(atual);
    if (!r.ok && r.motivo === 'conflito') r = await this.conferir(atual, r);
    if (r.ok) {
      this.revisao = r.revisao;
      this.tentativas = 0;
      this.semResposta = [];
      if (!this.pendente) this.o.guardar(null);
      if (this.parado) return true;
      if (this.pendente) {
        this.o.aoMudar('esperando');
        this.agendar(0);
      } else this.o.aoMudar('salvo');
      return true;
    }
    // O que não chegou volta pra fila (a não ser que já tenha coisa mais nova).
    this.pendente ??= atual;
    if (r.motivo === 'recusado') {
      // Uma cópia recusada voltaria a cada vez que o fluxo abrisse e seria recusada de novo: não fica.
      this.o.guardar(null);
    } else this.o.guardar({ revisao: this.revisao, ...this.pendente });
    if (this.parado) return false;
    if (r.motivo === 'rede' || r.motivo === 'sessao') {
      this.o.aoMudar(r.motivo === 'rede' ? 'sem_rede' : 'sem_sessao');
      this.agendar(proximaTentativa(this.tentativas++));
      return false;
    }
    this.parar();
    this.o.aoMudar(r.motivo === 'conflito' ? 'conflito' : r.motivo === 'trava' ? 'sem_trava' : 'recusado', r.mensagem);
    return false;
  }

  /** Manda, desistindo depois do `limite`. Exceção ou tempo esgotado é rede (e o envio pode ter chegado). */
  private async tentar(v: Versao): Promise<Resposta> {
    const ctl = new AbortController();
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const esgotou = new Promise<Resposta>((resolve) => {
      relogio = setTimeout(() => {
        ctl.abort();
        resolve({ ok: false, motivo: 'rede' });
      }, this.o.limite ?? 20_000);
    });
    let r: Resposta;
    try {
      r = await Promise.race([this.o.enviar(this.revisao, v.documento, v.estilo, ctl.signal), esgotou]);
    } catch {
      r = { ok: false, motivo: 'rede' };
    } finally {
      clearTimeout(relogio);
    }
    if (!r.ok && r.motivo === 'rede') this.semResposta = [...this.semResposta.slice(-19), v];
    return r;
  }

  /**
   * Conflito depois de um envio sem resposta pode ser o próprio envio, que chegou: o banco está uma revisão à frente
   * com uma das versões daqui. Aí não é conflito: segue dessa revisão (e manda de novo só se ainda falta algo).
   */
  private async conferir(atual: Versao, conflito: Resposta): Promise<Resposta> {
    if (!this.semResposta.length || !this.o.ler) return conflito;
    let b: NoBanco | null = null;
    try {
      b = await this.o.ler();
    } catch {
      // Sem conseguir ler, fica o conflito.
    }
    const igual = (v: Versao) => b !== null && mesmoJson(b.documento, v.documento) && mesmoJson(b.estilo, v.estilo);
    if (!b || b.revisao !== this.revisao + 1 || !this.semResposta.some(igual)) return conflito;
    if (!igual(atual)) this.pendente ??= atual;
    return { ok: true, revisao: b.revisao };
  }
}

/** Compara dois valores JSON sem ligar pra ordem das chaves (o jsonb do banco reordena). */
export function mesmoJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const lb = b as unknown[];
    return a.length === lb.length && a.every((x, i) => mesmoJson(x, lb[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const ka = Object.keys(oa).filter((k) => oa[k] !== undefined);
  const kb = Object.keys(ob).filter((k) => ob[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(ob, k) && mesmoJson(oa[k], ob[k]));
}

/**
 * Erro do salvar_fluxo → motivo. 40001: revisão velha; P0001: trava de outra pessoa; login vencido ou inválido
 * (PGRST301/PGRST303/401): sessão; erro passageiro do banco ou do caminho (sem código, 5xx, 429, cancelado,
 * deadlock, tempo do comando): rede; o resto (o banco disse não): recusado.
 */
export function motivoDoErro(e: { code?: string; message?: string } | null | undefined, status?: number): Resposta {
  if (!e) return { ok: false, motivo: 'rede' };
  const c = e.code ?? '';
  if (c === '40001') return { ok: false, motivo: 'conflito' };
  if (c === 'P0001') return { ok: false, motivo: 'trava' };
  if (c === 'PGRST301' || c === 'PGRST303' || status === 401) return { ok: false, motivo: 'sessao' };
  if (c === '57014' || c === '40P01' || /^(08|53)/.test(c) || status === 429 || (status !== undefined && status >= 500)) return { ok: false, motivo: 'rede' };
  if (!c && status === 413) return { ok: false, motivo: 'recusado', mensagem: 'o fluxo ficou grande demais pra salvar' };
  if (!c && !(status !== undefined && status >= 400)) return { ok: false, motivo: 'rede' };
  return { ok: false, motivo: 'recusado', mensagem: e.message };
}

/** A cópia local de um fluxo vale se partiu da mesma revisão que o banco tem agora. */
export function copiaValida(copia: unknown, revisao: number): CopiaLocal | null {
  if (!copia || typeof copia !== 'object') return null;
  const c = copia as Partial<CopiaLocal>;
  return c.revisao === revisao && c.documento && c.estilo ? (c as CopiaLocal) : null;
}
