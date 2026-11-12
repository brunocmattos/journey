/** Ícones do protótipo, desenhados em 24×24. */
const TRACOS: Record<string, string> = {
  telefone: 'M5 4h3l2 5-2 1.2a11 11 0 0 0 5.8 5.8L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  audio: 'M4 9.5v5h3.5L13 19V5L7.5 9.5H4z M16.5 9.5a3.5 3.5 0 0 1 0 5 M18.8 7a7 7 0 0 1 0 10',
  relogio: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z M12 7.5V12l3 2',
  calendario: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M4 10h16 M8.5 3v4 M15.5 3v4',
  banco: 'M5 6c0-1.5 3.1-2.8 7-2.8s7 1.3 7 2.8-3.1 2.8-7 2.8S5 7.5 5 6z M5 6v12c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6 M5 12c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8',
  fila: 'M6 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4z M12 5.1a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8z M18 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4z M2.5 18a3.5 3.5 0 0 1 7 0 M7.5 19a4.5 4.5 0 0 1 9 0 M14.5 18a3.5 3.5 0 0 1 7 0',
  pessoa: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  desliga: 'M3 13.5c5-4.2 13-4.2 18 0l-2 3-4-1.2v-2.2a10 10 0 0 0-6 0v2.2l-4 1.2-2-3z',
  transferir: 'M4 8h13 M14 4.5 17.5 8 14 11.5 M20 16H7 M10 12.5 6.5 16 10 19.5',
  volta: 'M4 12a8 8 0 0 1 14-5.3 M18.5 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M5.5 21v-4h4',
  seta: 'M5 12h13 M13 6l6 6-6 6',
  alerta: 'M12 3.5 21.5 20h-19z M12 10v4.5 M12 17.3v.2',
  teclado: 'M6 5h.01 M12 5h.01 M18 5h.01 M6 11h.01 M12 11h.01 M18 11h.01 M6 17h.01 M12 17h.01 M18 17h.01',
  chat: 'M4 5h16v11H9.5L5 19.5V16H4z M8 9.5h8 M8 12.5h5',
  email: 'M5.5 5.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z m-1 1.5 7.5 6 7.5-6',
  play: 'M8 5.2v13.6L19 12z',
  pausa: 'M7 5h3v14H7z M14 5h3v14h-3z',
  recomecar: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4v4.5H9',
  desfazer: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  enquadrar: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  mais: 'M12 5v14 M5 12h14',
  menos: 'M5 12h14',
  seguir: 'M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4z M12 2.5v4 M12 17.5v4 M2.5 12h4 M17.5 12h4',
  fechar: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
  legenda: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M8 9h8 M8 13h8 M8 17h5',
  robo: 'M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z M12 4.5V8 M9.5 16h5',
};

const CHEIOS = new Set(['play', 'pausa']);

export function Icone({ nome, className = 'icone' }: { nome: keyof typeof TRACOS | string; className?: string }) {
  const d = TRACOS[nome] ?? TRACOS.seta!;
  const cheio = CHEIOS.has(nome);
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={d}
        fill={cheio ? 'currentColor' : 'none'}
        stroke={cheio ? 'none' : 'currentColor'}
        strokeWidth={nome === 'teclado' ? 3.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
