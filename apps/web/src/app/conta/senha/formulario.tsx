'use client';

import { useEffect, useId, useState } from 'react';
import { SENHA_MINIMA, mensagemDoErro } from '@/lib/acesso';
import { supabaseNavegador } from '@/lib/supabase/navegador';

/** A senha nova vai pelo navegador (`updateUser`, com a sessão daqui); salva, volta pra casa da empresa. */
export function FormularioSenha({ email }: { email: string }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const idRequisito = useId();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      console.error('[senha nova]', error.status, error.code, error.message);
      return setErro(mensagemDoErro(error).texto);
    }
    window.location.assign('/');
  }

  return (
    <form onSubmit={salvar} style={{ display: 'grid', gap: 10 }}>
      {/* Pro gerenciador de senhas saber de qual conta é a senha nova. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <label className="campo" htmlFor={id}>
        Senha nova
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: -6 }}>
        <input
          id={id}
          className="entrada-texto"
          type={ver ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={SENHA_MINIMA}
          aria-describedby={idRequisito}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button className="botao" type="button" aria-pressed={ver} aria-controls={id} onClick={() => setVer(!ver)}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <small id={idRequisito} style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>
        Pelo menos {SENHA_MINIMA} caracteres.
      </small>
      <button className="botao primario" type="submit" disabled={!pronto} aria-disabled={enviando || undefined}>
        {enviando ? 'Salvando…' : 'Salvar a senha'}
      </button>
      <div role="alert">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
    </form>
  );
}
