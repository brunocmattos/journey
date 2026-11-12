'use client';

import { useState } from 'react';
import type { Achado, Indice } from '@journey/nucleo';
import type { Intencional } from '@/lib/dados';
import { Agenda, pontosComAgenda } from './Agenda';

const ORDEM = { grave: 0, alerta: 1, observacao: 2 } as const;
const NOME_GRAVIDADE = { grave: 'grave', alerta: 'alerta', observacao: 'observação' } as const;

export interface PropsDiagnostico {
  idx: Indice;
  achados: Achado[];
  intencionais: Intencional[];
  /** As quatro devolvem o aviso pra mostrar junto do achado, quando há. */
  verNoMapa: (a: Achado) => string | undefined;
  simular: (a: Achado) => string | undefined;
  marcar: (chave: string, nota: string) => Promise<string | undefined>;
  desmarcar: (chave: string) => Promise<string | undefined>;
}

export function PainelDiagnostico({ idx, achados, intencionais, verNoMapa, simular, marcar, desmarcar }: PropsDiagnostico) {
  const [notaDe, setNotaDe] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  /** Aviso ou erro de uma ação, mostrado no próprio achado. */
  const [aviso, setAviso] = useState<{ chave: string; texto: string } | null>(null);
  // Só as marcações de achados que este diagnóstico ainda tem: as de achados que sumiram num import não contam.
  const chaves = new Set(achados.map((a) => a.chave));
  const marcadas = new Map(intencionais.filter((i) => chaves.has(i.chave)).map((i) => [i.chave, i]));
  const abertos = achados.filter((a) => !marcadas.has(a.chave)).sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);
  const conta = (g: Achado['gravidade']) => abertos.filter((a) => a.gravidade === g).length;
  const avisar = (chave: string, texto: string | undefined) => setAviso(texto ? { chave, texto } : null);
  const avisoDe = (chave: string) =>
    aviso?.chave === chave && (
      <p className="aviso-caixa erro" role="alert">
        {aviso.texto}
      </p>
    );
  return (
    <div data-testid="diagnostico">
      <p className="mudo" style={{ margin: '12px 0 10px' }}>
        O diagnóstico roda sozinho a cada versão. Marca como intencional o que é assim de propósito: sai da contagem e fica guardado abaixo.
      </p>
      {pontosComAgenda(idx).map((p) => (
        <Agenda key={p} idx={idx} ponto={p} />
      ))}
      <div className="numeros" style={{ marginBottom: 12 }}>
        <span className="selo grave">{conta('grave')} graves</span>
        <span className="selo alerta">{conta('alerta')} alertas</span>
        <span className="selo observacao">{conta('observacao')} observações</span>
      </div>
      {abertos.length === 0 && <p className="vazio">Nenhum achado aberto.</p>}
      <div className="lista-botoes">
        {abertos.map((a) => (
          <div className="achado" key={a.chave} data-chave={a.chave}>
            <span className={`selo ${a.gravidade}`} style={{ justifySelf: 'start' }}>
              {NOME_GRAVIDADE[a.gravidade]}
            </span>
            <b>{a.titulo}</b>
            <p>{a.texto}</p>
            <div className="acoes">
              <button className="botao pequeno" type="button" onClick={() => avisar(a.chave, verNoMapa(a))}>
                Ver no mapa
              </button>
              <button className="botao pequeno" type="button" onClick={() => avisar(a.chave, simular(a))}>
                Simular
              </button>
              <button className="botao pequeno" type="button" onClick={() => setNotaDe(notaDe === a.chave ? null : a.chave)}>
                Marcar como intencional
              </button>
            </div>
            {notaDe === a.chave && (
              <form
                className="linha-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setEnviando(a.chave);
                  const erro = await marcar(a.chave, nota);
                  setEnviando(null);
                  avisar(a.chave, erro);
                  if (erro) return;
                  setNotaDe(null);
                  setNota('');
                }}
              >
                <input className="entrada-texto" style={{ flex: '1 1 160px' }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Por que é assim?" aria-label="Nota" />
                <button className="botao pequeno primario" disabled={enviando === a.chave}>
                  Marcar
                </button>
              </form>
            )}
            {avisoDe(a.chave)}
          </div>
        ))}
      </div>
      {marcadas.size > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="rotulo-secao" style={{ cursor: 'pointer' }}>
            Intencionais ({marcadas.size})
          </summary>
          <div className="lista-botoes">
            {achados
              .filter((a) => marcadas.has(a.chave))
              .map((a) => (
                <div className="achado" key={a.chave} data-intencional={a.chave}>
                  <b>{a.titulo}</b>
                  <p>{marcadas.get(a.chave)!.nota || 'Sem nota.'}</p>
                  <div className="acoes">
                    <button
                      className="botao pequeno"
                      type="button"
                      disabled={enviando === a.chave}
                      onClick={async () => {
                        setEnviando(a.chave);
                        const erro = await desmarcar(a.chave);
                        setEnviando(null);
                        avisar(a.chave, erro);
                      }}
                    >
                      Voltar pra contagem
                    </button>
                  </div>
                  {avisoDe(a.chave)}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
