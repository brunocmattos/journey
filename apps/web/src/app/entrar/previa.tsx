/**
 * A prévia do quadro na página de entrar: um fluxo pequeno do protótipo (WhatsApp → decisão → e-mail), com a água
 * correndo pelos canos, parando na decisão e trocando de cor quando o fluxo troca de canal. Só SVG e CSS (entrar.css):
 * a página de entrar não carrega o editor nem o pacote do fluxo (o único JavaScript é o `ControleDaAnimacao`, que pausa
 * fora da tela e para depois de algumas voltas). Decorativa: fora do leitor de tela e do Tab. Com movimento reduzido, a
 * água fica parada, já no fim do caminho.
 */

// Os ícones das peças, os mesmos do protótipo (Icone.tsx), desenhados em 24×24.
import { ControleDaAnimacao } from './animacao';

const ICONES = {
  inicio: 'M8 5.2v13.6L19 12z',
  mensagem: 'M4 5h16v11H9.5L5 19.5V16H4z M8 9.5h8 M8 12.5h5',
  atendimento: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  fim: 'M5 21V4 M5 4h11l-2 4 2 4H5',
} as const;

function Peca({ x, y, w, nome, sub, icone, canal, molha }: { x: number; y: number; w: number; nome: string; sub: string; icone: keyof typeof ICONES; canal?: 'wa' | 'email'; molha?: string }) {
  const redonda = icone === 'inicio' || icone === 'fim';
  return (
    <g className={`pv-peca${molha ? ` molha-${molha}` : ''}`} transform={`translate(${x} ${y})`}>
      <rect className="pv-placa" x="0" y="3" width={w} height="52" rx={redonda ? 26 : 12} />
      <rect className="pv-corpo" x="0" y="0" width={w} height="52" rx={redonda ? 26 : 12} />
      {/* O nível da água: aparece quando a água chega na peça. */}
      <rect className={`pv-nivel ${canal === 'email' ? 'c-email' : 'c-wa'}`} x="1.5" y="24" width={w - 3} height="26.5" rx={redonda ? 24 : 10} />
      <rect className={`pv-tile${icone === 'inicio' ? ' c-wa-cheio' : ''}`} x="10" y="10" width="32" height="32" rx={icone === 'inicio' ? 16 : 9} />
      <path className={`pv-icone${icone === 'inicio' ? ' cheio' : ''}`} d={ICONES[icone]} transform="translate(16 16) scale(0.83)" />
      <text className="pv-nome" x="52" y="24">
        {nome}
      </text>
      <text className="pv-sub" x="52" y="40">
        {canal && <tspan className={canal === 'email' ? 'pv-ponto-email' : 'pv-ponto-wa'}>● </tspan>}
        {sub}
      </text>
    </g>
  );
}

/** Um cano: parede, miolo e a água (que enche do começo ao fim, com `pathLength` 1). */
function Cano({ d, agua, cor }: { d: string; agua: string; cor: 'wa' | 'email' }) {
  return (
    <g>
      <path className="pv-parede" d={d} />
      <path className="pv-miolo" d={d} />
      <path className={`pv-agua c-${cor} agua-${agua}`} d={d} pathLength={1} />
    </g>
  );
}

export function PreviaFluxo() {
  return (
    <div className="previa" aria-hidden="true">
      <svg viewBox="0 0 560 400" focusable="false" role="presentation">
        <Cano d="M206 62 H330" agua="a" cor="wa" />
        <Cano d="M425 88 V138" agua="b" cor="wa" />
        <Cano d="M425 252 V300" agua="c" cor="wa" />
        <Cano d="M330 326 H190" agua="d" cor="email" />
        {/* O caminho que a água não toma fica seco. */}
        <Cano d="M368 195 H216" agua="seca" cor="wa" />

        <Peca x={24} y={36} w={182} nome="Cliente chama" sub="WhatsApp" icone="inicio" canal="wa" molha="1" />
        <Peca x={330} y={36} w={192} nome="Boas-vindas" sub="Mensagem" icone="mensagem" molha="2" />
        <Peca x={24} y={169} w={192} nome="Atende o suporte" sub="Fila Suporte" icone="atendimento" />
        <Peca x={330} y={300} w={192} nome="Manda o protocolo" sub="E-mail" icone="mensagem" canal="email" molha="4" />
        <Peca x={24} y={300} w={166} nome="Resolvido" sub="Fim" icone="fim" molha="5" />

        {/* A decisão: um losango, que pulsa enquanto a água espera a escolha. */}
        <g className="pv-decisao" transform="translate(425 195)">
          <rect className="pv-pulso" x="-40" y="-40" width="80" height="80" rx="12" transform="rotate(45)" />
          <rect className="pv-placa" x="-40" y="-37" width="80" height="80" rx="12" transform="rotate(45)" />
          <rect className="pv-losango" x="-40" y="-40" width="80" height="80" rx="12" transform="rotate(45)" />
          <text className="pv-nome" x="0" y="-2" textAnchor="middle">
            Qual
          </text>
          <text className="pv-nome" x="0" y="14" textAnchor="middle">
            assunto?
          </text>
        </g>

        {/* As opções no cano: a escolhida acende. */}
        <g className="pv-opcao" transform="translate(292 195)">
          <rect x="-40" y="-12" width="80" height="24" rx="12" />
          <text x="0" y="4" textAnchor="middle">
            Suporte
          </text>
        </g>
        <g className="pv-opcao pv-escolhida" transform="translate(425 276)">
          <rect x="-46" y="-12" width="92" height="24" rx="12" />
          <text x="0" y="4" textAnchor="middle">
            Protocolo
          </text>
        </g>

        <g className="pv-tempo" transform="translate(24 374)">
          <text x="0" y="0">
            O cliente levou 4 min, do WhatsApp ao e-mail.
          </text>
        </g>
      </svg>
      <ControleDaAnimacao />
    </div>
  );
}
