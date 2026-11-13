'use client';

import { useEffect, useRef, useState } from 'react';
import { criarLink, revogarLink } from '@/acoes/links';
import { LIMITES_ESCONDER, VALIDADE_PADRAO, VALIDADES, descreverLink, enderecoDoLink, escolhasDoFormulario, rotuloValidade, situacao, type LinkResumo } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';
import { Confirmacao, focarDepois } from './Confirmacao';
import type { Cenario } from '@/editor/cenarios';
import type { VersaoResumo } from '@/lib/dados';

/**
 * O "Compartilhar": cria um link público só de leitura (a versão, o cenário inicial, esconder nomes e a validade) e
 * lista os que já foram criados, com copiar e revogar. É um <dialog> modal: o navegador prende o foco nele e o Esc
 * fecha; ao fechar, o foco volta pro botão que abriu. Sem a chave secreta no servidor, explica e não cria.
 */
export function Compartilhar({
  empresaId,
  fluxoId,
  aberto,
  aoFechar,
  voltarPara,
  configurado,
  versoes,
  cenarios,
  links,
  setLinks,
  soLeitura,
}: {
  empresaId: string;
  fluxoId: string;
  aberto: boolean;
  aoFechar: () => void;
  voltarPara: React.RefObject<HTMLElement | null>;
  configurado: boolean;
  versoes: readonly VersaoResumo[];
  cenarios: readonly Cenario[];
  links: readonly LinkResumo[];
  setLinks: (f: (ls: readonly LinkResumo[]) => readonly LinkResumo[]) => void;
  soLeitura: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      setAgora(new Date());
    } else if (!aberto && d.open) d.close();
  }, [aberto]);

  const endereco = (token: string) => enderecoDoLink(location.origin, token);
  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(endereco(token));
      setCopiado(token);
    } catch {
      setErro('Não deu pra copiar: seleciona o endereço e copia à mão.');
    }
  };

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="titulo-compartilhar"
      // Esc (cancel) e o "Fechar" passam por aqui: o estado acompanha e o foco volta pro botão.
      onClose={() => {
        aoFechar();
        voltarPara.current?.focus();
      }}
    >
      <div className="pop-cab">
        <h2 id="titulo-compartilhar">Compartilhar</h2>
        <button className="bi" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
          <Icone nome="fechar" />
        </button>
      </div>
      {!configurado ? (
        <p className="aviso-caixa info">Os links públicos ainda não estão configurados neste servidor (falta a chave secreta). Avisa quem cuida do Journey.</p>
      ) : soLeitura ? (
        <p className="dica">Pra criar um link, abra o fluxo pra editar (agora ele está só leitura).</p>
      ) : (
        <form
          className="form-link"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setErro(null);
            setCriando(true);
            const r = await criarLink(
              empresaId,
              fluxoId,
              escolhasDoFormulario({ versao: f.get('versao') as string, cenario: f.get('cenario') as string, esconder: f.get('esconder') === 'on', validade: f.get('validade') as string }),
            );
            setCriando(false);
            if (!r.link) return setErro(r.erro ?? 'Não deu pra criar o link.');
            const l = r.link;
            setLinks((ls) => [l, ...ls]);
            setNovo(l.token);
            setAgora(new Date());
          }}
        >
          <label className="campo">
            Versão
            <select name="versao" aria-label="Versão" defaultValue="">
              <option value="">o fluxo de agora (muda quando o fluxo mudar)</option>
              {versoes.map((v) => (
                <option key={v.numero} value={v.numero}>
                  versão {v.numero} — {v.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Cenário que toca ao abrir
            <select name="cenario" aria-label="Cenário que toca ao abrir" defaultValue="">
              <option value="">nenhum</option>
              {cenarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="interruptor">
            Esconder os nomes das pessoas
            <input type="checkbox" name="esconder" defaultChecked />
          </label>
          <p className="dica">{LIMITES_ESCONDER}</p>
          <label className="campo">
            Validade
            <select name="validade" aria-label="Validade" defaultValue={String(VALIDADE_PADRAO)}>
              {VALIDADES.map((v) => (
                <option key={String(v)} value={v === null ? 'sem' : v}>
                  {rotuloValidade(v)}
                </option>
              ))}
            </select>
          </label>
          <button className="botao primario" type="submit" disabled={criando}>
            {criando ? 'Criando…' : 'Criar link'}
          </button>
        </form>
      )}
      <div role="status">{erro && <p className="aviso-caixa erro">{erro}</p>}</div>
      {novo && (
        <div className="link-novo">
          <label className="campo">
            Link criado
            <input className="entrada-texto" readOnly value={endereco(novo)} onFocus={(e) => e.currentTarget.select()} data-testid="link-novo" />
          </label>
          <button className="botao" type="button" onClick={() => void copiar(novo)}>
            {copiado === novo ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      <h3 className="rotulo-secao">Links deste fluxo ({links.length})</h3>
      {links.length === 0 ? (
        <p className="dica">Nenhum link ainda.</p>
      ) : (
        <ul className="lista-pop" ref={lista} tabIndex={-1} aria-label="Links deste fluxo">
          {links.map((l) => {
            const s = situacao(l, agora);
            return (
              <li key={l.id} className="item-pop" data-testid="link">
                <div className="linha-pop">
                  <span className={`selo-s ${s === 'ativo' ? 'igual' : 'mudou'}`}>{s}</span>
                  <small className="mudo">{descreverLink(l, agora)}</small>
                </div>
                {s === 'ativo' && (
                  <div className="acoes-achado">
                    <button className="botao pequeno" type="button" onClick={() => void copiar(l.token)}>
                      {copiado === l.token ? 'Copiado' : 'Copiar'}
                    </button>
                    {!soLeitura &&
                      (revogando === l.id ? (
                        <Confirmacao
                          nao="Não revogar"
                          sim="Revogar pra sempre"
                          aoCancelar={() => {
                            setRevogando(null);
                            focarDepois(() => lista.current?.querySelector<HTMLElement>(`[data-revogar="${l.id}"]`));
                          }}
                          aoConfirmar={async () => {
                            setRevogando(null);
                            const r = await revogarLink(empresaId, fluxoId, l.id);
                            if (!r.revogado_em) {
                              setErro(r.erro ?? 'Não deu pra revogar.');
                              return focarDepois(() => lista.current?.querySelector<HTMLElement>(`[data-revogar="${l.id}"]`));
                            }
                            const quando = r.revogado_em;
                            setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, revogado_em: quando } : x)));
                            // O link revogado não tem mais botões: o foco fica na lista.
                            focarDepois(() => lista.current);
                          }}
                        />
                      ) : (
                        <button className="botao pequeno" type="button" data-revogar={l.id} onClick={() => setRevogando(l.id)}>
                          Revogar
                        </button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
