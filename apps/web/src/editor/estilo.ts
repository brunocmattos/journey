import type { Curva } from './geometria';

/**
 * Como o fluxo é desenhado e animado. Fica em fluxos.estilo (só o que muda em relação ao padrão vale, mas
 * guardamos inteiro: é pequeno). `canais` troca a cor da água de um canal só neste fluxo.
 */
export interface Estilo {
  canais: Record<string, string>;
  cano: 'cano' | 'linha' | 'tracejado';
  curva: Curva;
  espessura: number;
  velocidade: number;
  bolhas: boolean;
  brilho: boolean;
  ondas: boolean;
  holofote: boolean;
  camera: boolean;
  /** Segundos até a água seguir sozinha pela primeira opção; 0 é nunca. */
  autoEscolha: number;
}

export const ESTILO_PADRAO: Estilo = {
  canais: {},
  cano: 'cano',
  curva: 'suave',
  espessura: 10,
  velocidade: 1,
  bolhas: true,
  brilho: true,
  ondas: true,
  holofote: true,
  camera: true,
  autoEscolha: 0,
};

export const VELOCIDADES = [0.5, 1, 2, 4] as const;

const COR = /^#[0-9a-fA-F]{6}$/;
const entre = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
const um = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T => (opcoes.includes(v as T) ? (v as T) : padrao);
const sim = (v: unknown, padrao: boolean) => (typeof v === 'boolean' ? v : padrao);

/** Lê o estilo guardado sem confiar nele: o que faltar ou vier errado fica no padrão. */
export function lerEstilo(bruto: unknown): Estilo {
  const e = (bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {}) as Record<string, unknown>;
  const p = ESTILO_PADRAO;
  const canais: Record<string, string> = {};
  if (e.canais && typeof e.canais === 'object' && !Array.isArray(e.canais)) {
    for (const [k, v] of Object.entries(e.canais)) if (typeof v === 'string' && COR.test(v)) canais[k] = v;
  }
  return {
    canais,
    cano: um(e.cano, ['cano', 'linha', 'tracejado'], p.cano),
    curva: um(e.curva, ['suave', 'cotovelo', 'reta'], p.curva),
    espessura: Math.round(entre(e.espessura, 4, 20, p.espessura)),
    velocidade: entre(e.velocidade, 0.25, 4, p.velocidade),
    bolhas: sim(e.bolhas, p.bolhas),
    brilho: sim(e.brilho, p.brilho),
    ondas: sim(e.ondas, p.ondas),
    holofote: sim(e.holofote, p.holofote),
    camera: sim(e.camera, p.camera),
    autoEscolha: Math.round(entre(e.autoEscolha, 0, 10, p.autoEscolha)),
  };
}

/** Um canal da empresa, como o editor precisa: chave, nome e cor. */
export interface CanalEditor {
  chave: string;
  nome: string;
  cor: string;
}

/** A cor da água num canal: a do estilo do fluxo, senão a da empresa, senão um azul. */
export function corDoCanal(estilo: Estilo, canais: readonly CanalEditor[], chave: string | null | undefined): string {
  if (!chave) return '#1e8bdc';
  return estilo.canais[chave] ?? canais.find((c) => c.chave === chave)?.cor ?? '#1e8bdc';
}
