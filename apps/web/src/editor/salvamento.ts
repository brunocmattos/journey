import type { Documento } from '@journey/fluxo';
import type { Estilo } from './estilo';

/** O que o banco respondeu a um salvamento. */
export type Resposta =
  | { ok: true; revisao: number }
  /** conflito: outra pessoa salvou no meio (40001); trava: outra pessoa pegou a trava (P0001); rede: não chegou. */
  | { ok: false; motivo: 'conflito' | 'trava' | 'rede' | 'recusado'; mensagem?: string };

export type Situacao = 'salvo' | 'esperando' | 'salvando' | 'sem_rede' | 'conflito' | 'sem_trava' | 'recusado';

/** O que fica no navegador quando o salvamento não chega: o documento e a revisão de onde ele partiu. */
export interface CopiaLocal {
  revisao: number;
  documento: Documento;
  estilo: Estilo;
}

export interface OpcoesSalvamento {
  revisao: number;
  enviar: (revisao: number, documento: Documento, estilo: Estilo) => Promise<Resposta>;
  aoMudar: (s: Situacao, mensagem?: string) => void;
  guardar: (copia: CopiaLocal | null) => void;
  /** Quanto espera depois da última mudança (padrão 500 ms). */
  espera?: number;
}

/** Espera entre tentativas sem rede: 2 s, 4 s, 8 s… até 30 s. */
export const proximaTentativa = (n: number): number => Math.min(30_000, 2000 * 2 ** n);

/**
 * Salvamento automático: espera a pessoa parar de mexer, manda o documento inteiro com a revisão que tem e,
 * se mudou de novo enquanto mandava, manda outra vez. Um envio por vez. Sem rede, guarda no navegador e
 * tenta de novo; conflito, trava perdida ou recusa param tudo (a tela explica e pede pra recarregar).
 */
export class Salvamento {
  revisao: number;
  private pendente: { documento: Documento; estilo: Estilo } | null = null;
  private enviando = false;
  private parado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tentativas = 0;
  private readonly o: OpcoesSalvamento;

  constructor(o: OpcoesSalvamento) {
    this.o = o;
    this.revisao = o.revisao;
  }

  /** Tem mudança que ainda não chegou no banco? */
  get sujo(): boolean {
    return this.pendente !== null || this.enviando;
  }

  mudou(documento: Documento, estilo: Estilo): void {
    if (this.parado) return;
    this.pendente = { documento, estilo };
    this.o.aoMudar('esperando');
    this.agendar(this.o.espera ?? 500);
  }

  /** Manda já o que estiver pendente (ao sair da página, por exemplo). */
  async agora(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.enviar();
  }

  parar(): void {
    this.parado = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private agendar(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enviar();
    }, ms);
  }

  private async enviar(): Promise<void> {
    if (this.parado || this.enviando || !this.pendente) return;
    const atual = this.pendente;
    this.pendente = null;
    this.enviando = true;
    this.o.aoMudar('salvando');
    let r: Resposta;
    try {
      r = await this.o.enviar(this.revisao, atual.documento, atual.estilo);
    } catch {
      r = { ok: false, motivo: 'rede' };
    }
    this.enviando = false;
    if (r.ok) {
      this.revisao = r.revisao;
      this.tentativas = 0;
      if (this.pendente) {
        this.o.aoMudar('esperando');
        this.agendar(0);
      } else {
        this.o.guardar(null);
        this.o.aoMudar('salvo');
      }
      return;
    }
    // O que não chegou volta pra fila (a não ser que já tenha coisa mais nova) e fica guardado no navegador.
    this.pendente ??= atual;
    this.o.guardar({ revisao: this.revisao, ...this.pendente });
    if (r.motivo === 'rede') {
      this.o.aoMudar('sem_rede');
      this.agendar(proximaTentativa(this.tentativas++));
      return;
    }
    this.parar();
    this.o.aoMudar(r.motivo === 'conflito' ? 'conflito' : r.motivo === 'trava' ? 'sem_trava' : 'recusado', r.mensagem);
  }
}

/** Erro do Postgres → motivo. 40001: revisão velha; P0001: trava de outra pessoa. */
export function motivoDoErro(e: { code?: string; message?: string } | null | undefined): Resposta {
  if (!e) return { ok: false, motivo: 'rede' };
  if (e.code === '40001') return { ok: false, motivo: 'conflito' };
  if (e.code === 'P0001') return { ok: false, motivo: 'trava' };
  if (!e.code || e.code === 'PGRST301' || /fetch|network|Failed/i.test(e.message ?? '')) return { ok: false, motivo: 'rede' };
  return { ok: false, motivo: 'recusado', mensagem: e.message };
}

/** A cópia local de um fluxo vale se partiu da mesma revisão que o banco tem agora. */
export function copiaValida(copia: unknown, revisao: number): CopiaLocal | null {
  if (!copia || typeof copia !== 'object') return null;
  const c = copia as Partial<CopiaLocal>;
  return c.revisao === revisao && c.documento && c.estilo ? (c as CopiaLocal) : null;
}
