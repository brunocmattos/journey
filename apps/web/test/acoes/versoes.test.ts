import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bancoFalso } from './banco-falso';

const b = bancoFalso();
vi.mock('@/lib/dados', () => ({ usuarioAtual: async () => ({ supabase: b.supabase, usuario: { id: 'u1', email: 'ana@exemplo.com' } }) }));
const { marcarVersao } = await import('@/acoes/versoes');
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('acoes/versoes', () => {
  beforeEach(() => b.limpar());

  it('marca pela função do banco e devolve a versão como a lista mostra', async () => {
    b.quando('rpc.marcar_versao', { data: 3, error: null });
    b.quando('fluxo_versoes.select', { data: { numero: 3, nome: 'antes do horário novo', criada_em: '2026-11-13T10:00:00Z' }, error: null });
    expect(await marcarVersao('e1', 'f1', '  antes do horário novo ')).toEqual({
      versao: { numero: 3, nome: 'antes do horário novo', autor: 'ana@exemplo.com', criada_em: '2026-11-13T10:00:00Z' },
    });
    expect(b.feitas[0]).toMatchObject({ tabela: 'rpc:marcar_versao', valores: { p_fluxo: 'f1', p_nome: 'antes do horário novo' } });
    expect(b.feitas[1]!.filtros).toEqual([['empresa_id', 'e1'], ['fluxo_id', 'f1'], ['numero', 3]]);
  });

  it('nome vazio ou comprido nem vai pro banco', async () => {
    expect(await marcarVersao('e1', 'f1', '   ')).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(await marcarVersao('e1', 'f1', 'x'.repeat(121))).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(await marcarVersao('e1', 'f1', 7 as unknown as string)).toEqual({ erro: 'O nome da versão vai de 1 a 120 letras.' });
    expect(b.feitas).toEqual([]);
  });

  it('fluxo que sumiu (ou de outra empresa) vira texto pra pessoa', async () => {
    b.quando('rpc.marcar_versao', { error: { code: 'P0002', message: 'fluxo não encontrado' } });
    expect(await marcarVersao('e1', 'f1', 'x')).toEqual({ erro: 'Este fluxo não existe mais.' });
  });
});
