import Link from 'next/link';

export function Marca({ href = '/' }: { href?: string }) {
  return (
    <Link className="marca" href={href}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--pipe-wall)' }} strokeWidth="8" strokeLinecap="round" />
        <path d="M4 9h11a8 8 0 0 1 8 8v11" fill="none" style={{ stroke: 'var(--w-telefonia)' }} strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span>Journey</span>
    </Link>
  );
}
