'use client';

import { useRef, useState } from 'react';
import { criarLink, revogarLink } from '@/acoes/links';
import { dataCurta, descreverLink, enderecoDoLink, rotuloValidade, situacao, VALIDADE_PADRAO, VALIDADES, type LinkResumo, type Validade } from '@/compartilhar/opcoes';
import { Icone } from '@/componentes/Icone';

export interface PropsCompartilhar {
  empresaId: string;
  jornadaId: string;
  /** A versão na tela: é a que fica fixa quando a pessoa escolhe "só esta versão". */
  versao: number;
  cenarios: { id: string; nome: string }[];
  /** O cenário aberto agora, se houver: vem escolhido como cenário inicial. */
  cenarioAberto: string | null;
  links: LinkResumo[];
}

/** Copia; sem a API de área de transferência (página fora de HTTPS), seleciona o texto do campo pra copiar à mão. */
async function copiar(texto: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    campo?.select();
    return false;
  }
}

/**
 * "Compartilhar" (spec, 14): cria um link só de leitura da jornada, com versão fixa ou a mais recente, nomes escondidos
 * (ligado por padrão), cenário inicial e validade; lista os links já criados, com copiar e revogar.
 */
export function Compartilhar(p: PropsCompartilhar) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  // O conteúdo só existe com o diálogo aberto: a lista usa a hora de agora, que no servidor seria outra.
  const [aberto, setAberto] = useState<{ agora: Date } | null>(null);
  const [fixa, setFixa] = useState(false);
  const [esconder, setEsconder] = useState(true);
  const [cenarioId, setCenarioId] = useState('');
  const [validade, setValidade] = useState<Validade>(VALIDADE_PADRAO);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<{ de: string; texto: string } | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const abrir = () => {
    setCenarioId(p.cenarioAberto ?? '');
    setNovo(null);
    setErro(null);
    setCopiado(null);
    setAberto({ agora: new Date() });
    dialogo.current?.showModal();
  };

  const criar = async () => {
    setEnviando('novo');
    setErro(null);
    const r = await criarLink(p.empresaId, p.jornadaId, { versao: fixa ? p.versao : null, esconderNomes: esconder, cenarioId: cenarioId || null, validade });
    setEnviando(null);
    if (r.erro || !r.token) {
      setErro({ de: 'novo', texto: r.erro ?? 'Não deu certo agora. Tenta de novo em instantes.' });
      return;
    }
    const endereco = enderecoDoLink(window.location.origin, r.token);
    setNovo(endereco);
    setCopiado((await copiar(endereco, campo.current)) ? endereco : null);
    setAberto({ agora: new Date() });
  };

  const revogar = async (l: LinkResumo) => {
    if (!window.confirm('Revogar este link? Quem abrir depois vê que ele foi revogado. Não tem volta.')) return;
    setEnviando(l.id);
    setErro(null);
    const r = await revogarLink(p.empresaId, p.jornadaId, l.id);
    setEnviando(null);
    if (r.erro) setErro({ de: l.id, texto: r.erro });
    if (novo?.endsWith(`/l/${l.token}`)) setNovo(null);
    setAberto({ agora: new Date() });
  };

  const erroDe = (de: string) =>
    erro?.de === de && (
      <p className="aviso-caixa erro" role="alert">
        {erro.texto}
      </p>
    );

  return (
    <>
      <div className="compartilhar">
        <button className="botao pequeno" type="button" onClick={abrir}>
          <Icone nome="link" /> Compartilhar
        </button>
      </div>
      <dialog ref={dialogo} className="dialogo" aria-labelledby="titulo-compartilhar" onClose={() => setAberto(null)}>
        {aberto && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="cabeca">
              <h2 id="titulo-compartilhar">Compartilhar</h2>
              <button className="bi" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
                <Icone nome="fechar" />
              </button>
            </div>
            <p className="mudo" style={{ margin: 0 }}>
              Quem abre o link não precisa de conta: vê o mapa, simula e vê o diagnóstico. Não vê o histórico, os ajustes nem os outros cenários.
            </p>
            <form
              style={{ display: 'grid', gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                void criar();
              }}
            >
              <fieldset className="grupo-escolhas">
                <legend>Versão</legend>
                <label className="escolha">
                  <input type="radio" name="versao" checked={!fixa} onChange={() => setFixa(false)} /> Sempre a mais recente
                </label>
                <label className="escolha">
                  <input type="radio" name="versao" checked={fixa} onChange={() => setFixa(true)} /> Só a versão {p.versao} (a de agora)
                </label>
              </fieldset>
              <label className="escolha">
                <input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} /> Esconder nomes
              </label>
              <p className="dica" style={{ margin: '-6px 0 0 24px' }}>
                {esconder
                  ? 'O nome de quem usa cada ramal sai do link, também dos textos e das opções do mapa. O número do ramal continua.'
                  : 'Quem abrir vê os nomes das pessoas nos ramais.'}
              </p>
              <label className="campo">
                Cenário inicial
                <select value={cenarioId} onChange={(e) => setCenarioId(e.target.value)}>
                  <option value="">Nenhum: abre o mapa parado</option>
                  {p.cenarios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Validade
                <select value={String(validade)} onChange={(e) => setValidade(e.target.value === 'null' ? null : (Number(e.target.value) as Validade))}>
                  {VALIDADES.map((v) => (
                    <option key={String(v)} value={String(v)}>
                      {rotuloValidade(v)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="botao primario" disabled={enviando === 'novo'}>
                Criar link
              </button>
              {erroDe('novo')}
            </form>
            {novo && (
              <div className="linha-form" data-testid="link-novo">
                <input ref={campo} className="entrada-texto" style={{ flex: '1 1 240px' }} readOnly value={novo} aria-label="Endereço do link" onFocus={(e) => e.target.select()} />
                <button
                  className="botao"
                  type="button"
                  onClick={async () => setCopiado((await copiar(novo, campo.current)) ? novo : null)}
                >
                  {copiado === novo ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            <div className="rotulo-secao">Links desta jornada</div>
            {p.links.length === 0 ? (
              <p className="vazio">Nenhum link ainda.</p>
            ) : (
              <div className="lista-botoes" data-testid="links">
                {p.links.map((l) => {
                  const s = situacao(l, aberto.agora);
                  const endereco = enderecoDoLink(window.location.origin, l.token);
                  return (
                    <div className="achado" key={l.id} data-situacao={s}>
                      <b>{l.cenario_nome ?? 'Sem cenário'}</b>
                      <p>{descreverLink(l, aberto.agora)}</p>
                      <p className="mudo" style={{ fontSize: 12 }}>
                        criado em {dataCurta(l.criado_em)}
                      </p>
                      {s === 'ativo' && (
                        <div className="acoes">
                          <button className="botao pequeno" type="button" onClick={async () => setCopiado((await copiar(endereco, null)) ? endereco : null)}>
                            {copiado === endereco ? 'Copiado' : 'Copiar'}
                          </button>
                          <button className="botao pequeno perigo" type="button" disabled={enviando === l.id} onClick={() => void revogar(l)}>
                            Revogar
                          </button>
                        </div>
                      )}
                      {erroDe(l.id)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
