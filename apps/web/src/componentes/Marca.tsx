import Link from 'next/link';

/** A marca do Journey. Com `href={null}` (link público, sem conta), não leva a lugar nenhum. */
export function Marca({ href = '/' }: { href?: string | null }) {
  const desenho = (
    <>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--pipe-wall)' }} strokeWidth="8" strokeLinecap="round" />
        <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--w-telefonia)' }} strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span>Journey</span>
    </>
  );
  return href === null ? (
    <span className="marca">{desenho}</span>
  ) : (
    <Link className="marca" href={href}>
      {desenho}
    </Link>
  );
}
