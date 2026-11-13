import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A chave secreta passa por cima das regras de acesso. Só o link público precisa dela, e só num lugar.
const SRC = fileURLToPath(new URL('../src', import.meta.url));

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(e.name) ? [caminho] : [];
  });
}

describe('chave secreta', () => {
  const todos = arquivos(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, 'utf8')] as const);

  const leem = todos.filter(([, texto]) => /SUPABASE_SECRET_KEY|SERVICE_ROLE|sb_secret_/.test(texto));

  it('só src/lib/link.ts lê SUPABASE_SECRET_KEY', () => {
    expect(leem.map(([nome]) => nome).filter((nome) => nome !== 'lib/link.ts')).toEqual([]);
  });

  it('o next.config não tem env: (iria pro bundle do navegador)', () => {
    const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
    expect(config).not.toMatch(/\benv\s*:/);
  });

  it('e ele é só do servidor', () => {
    expect(leem.filter(([, texto]) => !texto.startsWith("import 'server-only';")).map(([nome]) => nome)).toEqual([]);
  });

  it('nenhum componente de cliente importa lib/link', () => {
    const clientes = todos.filter(([, texto]) => texto.startsWith("'use client'"));
    expect(clientes.length).toBeGreaterThan(5);
    expect(clientes.filter(([, texto]) => texto.includes('@/lib/link')).map(([nome]) => nome)).toEqual([]);
  });
});
