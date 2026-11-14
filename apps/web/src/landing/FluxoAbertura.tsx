/**
 * O fluxo da abertura da landing: o "Suporte no WhatsApp" desenhado à mão, no estilo das peças do editor, com a água
 * parada nos canos e um brilho correndo devagar. Os quatro caminhos têm um selo: Boleto chega rápido, Suporte passa da
 * meta, Outro cai num cano sem saída (que pinga) e Não entendi volta pras boas-vindas. Só SVG e CSS (landing.css), com
 * os tokens do globals.css (segue o tema): a abertura não carrega o editor nem o @journey/fluxo. Dois desenhos, o largo
 * e o de pé (pro celular, onde o largo teria letra de 7 px); o CSS mostra um só. Com movimento reduzido, nada anda.
 */

// Os ícones das peças, os mesmos do editor (e da prévia do entrar), desenhados em 24×24.
const ICONES = {
  mensagem: 'M4 5h16v11H9.5L5 19.5V16H4z M8 9.5h8 M8 12.5h5',
  atendimento: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  fim: 'M5 21V4 M5 4h11l-2 4 2 4H5',
} as const;

// Os ícones dos selos, em 12×12: certo, xis e a volta.
const MARCAS = {
  ok: 'M2.5 6.5l2.5 2.5 4.5-5.5',
  bad: 'M3 3l6 6 M9 3l-6 6',
  loop: 'M9.5 4.5A4 4 0 1 0 10 7.5 M9.8 1.8v3h-3',
} as const;

type Cor = 'ok' | 'warn' | 'bad' | 'loop';

interface Desenho {
  largura: number;
  altura: number;
  inicio: { x: number; y: number; w: number };
  pecas: { x: number; y: number; w: number; nome: string; sub: string; icone: keyof typeof ICONES }[];
  decisao: { x: number; y: number };
  /** Os canos com água: o verde do WhatsApp, ou o roxo da volta. */
  canos: { d: string; volta?: boolean }[];
  /** Onde o cano sem saída acaba: a água pinga dali numa poça. */
  pinga: { x: number; y: number };
  opcoes: { x: number; y: number; w: number; texto: string }[];
  selos: { x: number; y: number; w: number; texto: string; cor: Cor }[];
}

const H = 52;

/** O desenho largo: o do protótipo, com a opção "Não entendi" no cano da volta. */
const LARGO: Desenho = {
  largura: 660,
  altura: 420,
  inicio: { x: 10, y: 78, w: 180 },
  pecas: [
    { x: 236, y: 78, w: 160, nome: 'Boas-vindas', sub: 'Mensagem', icone: 'mensagem' },
    { x: 436, y: 210, w: 160, nome: '2ª via enviada', sub: 'Mensagem', icone: 'mensagem' },
    { x: 236, y: 210, w: 160, nome: 'Fila Suporte', sub: 'Atendimento', icone: 'atendimento' },
    { x: 436, y: 316, w: 160, nome: 'Resolvido', sub: 'Fim', icone: 'fim' },
    { x: 236, y: 316, w: 160, nome: 'Atendido', sub: 'Fim', icone: 'fim' },
  ],
  decisao: { x: 516, y: 104 },
  canos: [
    { d: 'M190 104H236' },
    { d: 'M396 104H474' },
    { d: 'M516 62V30H316V78', volta: true },
    { d: 'M516 146V210' },
    { d: 'M516 146V174H316V210' },
    { d: 'M516 174H110V238' },
    { d: 'M516 262V316' },
    { d: 'M316 262V316' },
  ],
  pinga: { x: 110, y: 238 },
  opcoes: [
    { x: 440, y: 30, w: 92, texto: 'Não entendi' },
    { x: 516, y: 192, w: 62, texto: 'Boleto' },
    { x: 316, y: 192, w: 70, texto: 'Suporte' },
    { x: 110, y: 203, w: 56, texto: 'Outro' },
  ],
  selos: [
    { x: 249, y: 30, w: 122, texto: 'Volta pro menu', cor: 'loop' },
    { x: 110, y: 302, w: 100, texto: 'Sem saída', cor: 'bad' },
    { x: 316, y: 392, w: 180, texto: '18 min, acima da meta', cor: 'warn' },
    { x: 516, y: 392, w: 146, texto: 'chegou em 3 min', cor: 'ok' },
  ],
};

/** O desenho de pé, pro celular: o mesmo fluxo de cima pra baixo, a volta pela esquerda e o cano sem saída à direita. */
const DE_PE: Desenho = {
  largura: 400,
  altura: 576,
  inicio: { x: 114, y: 16, w: 172 },
  pecas: [
    { x: 120, y: 100, w: 160, nome: 'Boas-vindas', sub: 'Mensagem', icone: 'mensagem' },
    { x: 24, y: 372, w: 160, nome: 'Fila Suporte', sub: 'Atendimento', icone: 'atendimento' },
    { x: 220, y: 372, w: 160, nome: '2ª via enviada', sub: 'Mensagem', icone: 'mensagem' },
    { x: 24, y: 470, w: 160, nome: 'Atendido', sub: 'Fim', icone: 'fim' },
    { x: 220, y: 470, w: 160, nome: 'Resolvido', sub: 'Fim', icone: 'fim' },
  ],
  decisao: { x: 200, y: 232 },
  canos: [
    { d: 'M200 68V100' },
    { d: 'M200 152V190' },
    { d: 'M158 232H34V126H120', volta: true },
    { d: 'M242 232H352V262' },
    { d: 'M200 274V340H104V372' },
    { d: 'M200 274V340H300V372' },
    { d: 'M104 424V470' },
    { d: 'M300 424V470' },
  ],
  pinga: { x: 352, y: 262 },
  opcoes: [
    { x: 96, y: 232, w: 92, texto: 'Não entendi' },
    { x: 297, y: 232, w: 56, texto: 'Outro' },
    { x: 104, y: 356, w: 70, texto: 'Suporte' },
    { x: 300, y: 356, w: 62, texto: 'Boleto' },
  ],
  selos: [
    { x: 100, y: 172, w: 122, texto: 'Volta pro menu', cor: 'loop' },
    { x: 352, y: 316, w: 92, texto: 'Sem saída', cor: 'bad' },
    { x: 104, y: 549, w: 170, texto: '18 min, acima da meta', cor: 'warn' },
    { x: 300, y: 549, w: 140, texto: 'chegou em 3 min', cor: 'ok' },
  ],
};

const DESCRICAO =
  'Fluxo de suporte no WhatsApp: a água sai de Cliente chama, passa pelas boas-vindas e chega na decisão Assunto. ' +
  'Boleto chega em Resolvido em 3 minutos; Suporte passa pela fila e chega em Atendido em 18 minutos, acima da meta; ' +
  'Outro cai num cano sem saída; e Não entendi volta pras boas-vindas, de novo pro menu.';

function Peca({ x, y, w, nome, sub, icone }: Desenho['pecas'][number]) {
  const redonda = icone === 'fim';
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="fa-placa" y="3" width={w} height={H} rx={redonda ? H / 2 : 12} />
      <rect className="fa-corpo" width={w} height={H} rx={redonda ? H / 2 : 12} />
      <rect className="fa-tile" x="10" y="10" width="32" height="32" rx={redonda ? 16 : 9} />
      <path className="fa-icone" d={ICONES[icone]} transform="translate(16 16) scale(0.83)" />
      <text className="fa-nome" x="52" y="23">
        {nome}
      </text>
      <text className="fa-sub" x="52" y="40">
        {sub}
      </text>
    </g>
  );
}

function Desenho({ d, classe }: { d: Desenho; classe: string }) {
  const { inicio: i, decisao: k, pinga: p } = d;
  return (
    <svg className={`fluxo-abertura ${classe}`} viewBox={`0 0 ${d.largura} ${d.altura}`} role="img" aria-label={DESCRICAO}>
      {/* Os canos: parede, miolo, a água e o brilho que corre. */}
      {d.canos.map((c) => (
        <g key={c.d} className={c.volta ? 'fa-cano volta' : 'fa-cano'}>
          <path className="fa-parede" d={c.d} />
          <path className="fa-miolo" d={c.d} />
          <path className="fa-agua" d={c.d} />
          <path className="fa-brilho" d={c.d} />
        </g>
      ))}

      {/* O cano sem saída pinga numa poça. */}
      <ellipse className="fa-poca" cx={p.x} cy={p.y + 36} rx="22" ry="4.5" />
      {[0, 1, 2].map((n) => (
        <circle key={n} className="fa-gota" cx={p.x + (n - 1) * 2} cy={p.y + 6} r={2.6 - n * 0.2} />
      ))}

      {/* O Início: a pílula com o play no tile, na cor do WhatsApp. */}
      <g transform={`translate(${i.x} ${i.y})`}>
        <rect className="fa-placa" y="3" width={i.w} height={H} rx={H / 2} />
        <rect className="fa-corpo" width={i.w} height={H} rx={H / 2} />
        <circle className="fa-play" cx="26" cy="26" r="16" />
        <path className="fa-triangulo" d="M21 18.5v15l12-7.5z" />
        <text className="fa-nome" x="52" y="23">
          Cliente chama
        </text>
        <text className="fa-sub" x="52" y="40">
          <tspan className="fa-ponto">● </tspan>WhatsApp
        </text>
      </g>

      {d.pecas.map((x) => (
        <Peca key={x.nome} {...x} />
      ))}

      {/* A decisão: o losango. */}
      <g transform={`translate(${k.x} ${k.y})`}>
        <rect className="fa-placa" x="-30" y="-27" width="60" height="60" rx="10" transform="rotate(45)" />
        <rect className="fa-losango" x="-30" y="-30" width="60" height="60" rx="10" transform="rotate(45)" />
        <text className="fa-nome fa-centro" y="5">
          Assunto?
        </text>
      </g>

      {/* As opções, nos canos. */}
      {d.opcoes.map((o) => (
        <g key={o.texto} className="fa-opcao" transform={`translate(${o.x} ${o.y})`}>
          <rect x={-o.w / 2} y="-11" width={o.w} height="22" rx="11" />
          <text className="fa-centro" y="4">
            {o.texto}
          </text>
        </g>
      ))}

      {/* Os selos: como cada caminho termina. */}
      {d.selos.map((s) => (
        <g key={s.texto} className={`fa-selo ${s.cor}`} transform={`translate(${s.x} ${s.y})`}>
          <rect x={-s.w / 2} y="-13" width={s.w} height="26" rx="13" />
          {s.cor !== 'warn' && <path className="fa-marca" d={MARCAS[s.cor]} transform={`translate(${-s.w / 2 + 11} -6)`} />}
          <text className="fa-centro" x={s.cor === 'warn' ? 0 : 8} y="4">
            {s.texto}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function FluxoAbertura() {
  return (
    <div className="abertura-fluxo">
      <Desenho d={LARGO} classe="largo" />
      <Desenho d={DE_PE} classe="de-pe" />
    </div>
  );
}
