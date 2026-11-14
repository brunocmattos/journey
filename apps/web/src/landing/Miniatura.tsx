import type { ChaveAba } from './abas';

/**
 * A miniatura de um exemplo: o estilo do cano dele (a linha reta da URA, o cano suave do WhatsApp, o cano com cotovelo
 * do SAC, o tracejado da esteira), na cor do canal (`--c`, posta por quem usa), com as peças nos tokens do tema e o
 * problema de cada um num detalhe. Decorativa: o nome e a dor estão no texto da aba.
 */
export function Miniatura({ chave }: { chave: ChaveAba }) {
  return (
    <svg className={`l-mini m-${chave}`} viewBox="0 0 240 96" aria-hidden="true" focusable="false">
      {chave === 'ura' && (
        <>
          <path className="m-linha" d="M28 40H198" />
          <path className="m-linha" d="M100 62V80H150" />
          <circle className="m-poca" cx="158" cy="80" r="4" />
          <Inicio />
          <Losango x={100} />
          <rect className="m-peca" x="140" y="28" width="36" height="24" rx="6" />
          <rect className="m-peca" x="194" y="29" width="34" height="22" rx="11" />
        </>
      )}
      {chave === 'whatsapp' && (
        <>
          <path className="m-cano" d="M28 40H200" />
          <path className="m-agua" d="M28 40H200" />
          <path className="m-cano" d="M138 26C138 6 76 6 76 26" />
          <path className="m-agua m-volta" d="M138 26C138 6 76 6 76 26" />
          <Inicio />
          <rect className="m-peca" x="58" y="27" width="40" height="26" rx="7" />
          <Losango x={138} />
          <rect className="m-peca" x="190" y="29" width="38" height="22" rx="11" />
        </>
      )}
      {chave === 'email' && (
        <>
          <path className="m-cano grosso" d="M28 40H118V72H200" />
          <path className="m-agua grosso" d="M28 40H118V72H200" />
          <Inicio />
          <rect className="m-peca" x="62" y="27" width="40" height="26" rx="7" />
          <rect className="m-peca m-espera" x="100" y="58" width="44" height="28" rx="7" />
          <rect className="m-peca" x="190" y="61" width="38" height="22" rx="11" />
        </>
      )}
      {chave === 'credito' && (
        <>
          <path className="m-tracejado" d="M28 40H92V70H206" />
          <Inicio />
          <rect className="m-peca" x="58" y="27" width="40" height="26" rx="7" />
          <rect className="m-peca m-espera" x="124" y="56" width="50" height="28" rx="7" />
          <rect className="m-peca" x="196" y="59" width="34" height="22" rx="11" />
        </>
      )}
    </svg>
  );
}

const Inicio = () => (
  <>
    <circle className="m-inicio" cx="28" cy="40" r="12" />
    <path className="m-play" d="M24.5 34.5v11l8.5-5.5z" />
  </>
);

const Losango = ({ x }: { x: number }) => (
  <rect className="m-peca m-losango" x={x - 15} y="25" width="30" height="30" rx="5" transform={`rotate(45 ${x} 40)`} />
);
