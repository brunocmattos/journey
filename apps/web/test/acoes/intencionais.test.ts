import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase, usuario: { id: 'u1', email: 'ana@exemplo.com' } }) }));
const { desmarcarIntencional, marcarIntencional } = await import('@/acoes/intencionais');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/intencionais', () => {
  beforeEach(() => b.limpar());

  it('marca com a nota (upsert das quatro colunas) e devolve com o e-mail de quem marcou', async () => {
    b.quando('achados_intencionais.upsert', { data: { chave: 'beco_sem_saida:a', nota: 'de propósito', autor: 'u1', criado_em: '2026-11-13T10:00:00Z' }, error: null });
    expect(await marcarIntencional('e1', 'f1', 'beco_sem_saida:a', ' de propósito ')).toEqual({
      intencional: { chave: 'beco_sem_saida:a', nota: 'de propósito', autor: 'ana@exemplo.com', criado_em: '2026-11-13T10:00:00Z' },
    });
    expect(b.feitas[0]).toMatchObject({ op: 'upsert', valores: { empresa_id: 'e1', fluxo_id: 'f1', chave: 'beco_sem_saida:a', nota: 'de propósito' } });
  });

  it('marcar de novo o que outra pessoa marcou: quem marcou continua sendo ela', async () => {
    b.quando('achados_intencionais.upsert', { data: { chave: 'k', nota: 'nova', autor: 'u2', criado_em: '2026-11-12T10:00:00Z' }, error: null });
    b.quando('membros.select', { data: { email: 'caio@exemplo.com' }, error: null });
    expect((await marcarIntencional('e1', 'f1', 'k', 'nova')).intencional?.autor).toBe('caio@exemplo.com');
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['usuario_id', 'u2']]);
  });

  it('chave ou nota fora do que o banco aceita nem vai', async () => {
    expect(await marcarIntencional('e1', 'f1', '', 'x')).toEqual({ erro: 'Achado inválido.' });
    expect(await marcarIntencional('e1', 'f1', 'x'.repeat(2001), 'x')).toEqual({ erro: 'Achado inválido.' });
    expect(await marcarIntencional('e1', 'f1', 'k', 'x'.repeat(5001))).toEqual({ erro: 'A nota vai até 5000 letras.' });
    expect(await marcarIntencional('e1', 'f1', 'k', null as unknown as string)).toEqual({ erro: 'A nota vai até 5000 letras.' });
    expect(b.feitas).toEqual([]);
  });

  it('desmarca só neste fluxo e empresa; já desmarcado também dá certo', async () => {
    expect(await desmarcarIntencional('e1', 'f1', 'k')).toEqual({});
    expect(b.feitas[0]).toMatchObject({ op: 'delete', filtros: [['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['chave', 'k']] });
    b.quando('achados_intencionais.delete', { error: { code: '42501', message: 'rls' } });
    expect(await desmarcarIntencional('e1', 'f1', 'k')).toEqual({ erro: 'Sem acesso a esta empresa.' });
  });
});
