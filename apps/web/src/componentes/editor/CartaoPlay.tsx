'use client';

import { formatarTempo, type Documento } from '@journey/fluxo';
import { Icone } from '@/componentes/Icone';
import { VELOCIDADES, type CanalEditor } from '@/editor/estilo';
import { quandoValido, tituloDoFim, type Play, type Visual } from '@/editor/play';

export interface AcoesPlay {
  escolher(conexao: string): void;
  pausar(): void;
  voltar(): void;
  recomecar(): void;
  parar(): void;
  velocidade(v: number): void;
  quando(q: string): void;
  relogio(decide: boolean): void;
  comecarEm(inicio: string): void;
}

/** O cartão de baixo durante o play: a pergunta com as opções, o fim com o resumo, os controles e a linha do tempo. */
export function CartaoPlay({
  doc,
  play,
  visual,
  pausado,
  velocidade,
  autoEscolha,
  corAgua,
  canais,
  inicios,
  acoes,
}: {
  doc: Documento;
  play: Play | null;
  visual: Visual | null;
  pausado: boolean;
  velocidade: number;
  autoEscolha: number;
  corAgua: (canal: string | null) => string;
  canais: readonly CanalEditor[];
  /** Quando há mais de um Início e nenhum selecionado: a pergunta "por onde começa?". */
  inicios: string[] | null;
  acoes: AcoesPlay;
}) {
  const nome = (id: string | null | undefined) => doc.pecas.find((p) => p.id === id)?.nome ?? '';
  const nomeCanal = (k: string | null) => canais.find((c) => c.chave === k)?.nome ?? 'sem canal';

  if (inicios) {
    return (
      <div className="cartao-sim" role="region" aria-label="Simulação">
        <div className="pergunta">Por onde a jornada começa?</div>
        <div className="opcoes">
          {inicios.map((id, i) => (
            <button key={id} className="opcao" type="button" onClick={() => acoes.comecarEm(id)}>
              <span className="tecla">{i + 1}</span>
              <span>{nome(id)}</span>
            </button>
          ))}
        </div>
        <div className="controles">
          <button className="bi" type="button" aria-label="Parar" style={{ marginLeft: 'auto' }} onClick={acoes.parar}>
            <Icone nome="fechar" />
          </button>
        </div>
      </div>
    );
  }
  if (!play || !visual) return null;

  const canal = visual.canal;
  const canaisDoCaminho = [...new Set([...visual.molhadas.values()])];
  const controles = (
    <div className="controles">
      <button className="bi" type="button" aria-label={pausado ? 'Continuar' : 'Pausar'} onClick={acoes.pausar}>
        <Icone nome={pausado ? 'play' : 'pausa'} />
      </button>
      <button className="bi" type="button" aria-label="Voltar uma decisão" title="Voltar uma decisão" onClick={acoes.voltar}>
        <Icone nome="voltar" />
      </button>
      <button className="bi" type="button" aria-label="Recomeçar" title="Recomeçar" onClick={acoes.recomecar}>
        <Icone nome="recomecar" />
      </button>
      <div className="vel" role="group" aria-label="Velocidade">
        {VELOCIDADES.map((v) => (
          <button key={v} type="button" aria-pressed={velocidade === v} onClick={() => acoes.velocidade(v)}>
            {v}×
          </button>
        ))}
      </div>
      <button className="bi" type="button" aria-label="Parar" style={{ marginLeft: 'auto' }} onClick={acoes.parar}>
        <Icone nome="fechar" />
      </button>
    </div>
  );

  let corpo: React.ReactNode;
  if (visual.fim) {
    corpo = (
      <div data-testid="fim" style={{ display: 'grid', gap: 10 }}>
        <div className="pergunta">
          {tituloDoFim(visual.fim.motivo)}: {nome(visual.fim.peca)}
        </div>
        <div className="numeros">
          <span>
            <b>{new Set(visual.linha.map((l) => l.peca)).size}</b>peças
          </span>
          <span>
            <b>{formatarTempo(visual.relogio_s)}</b>pro cliente
          </span>
          <span>
            <b>{canaisDoCaminho.length}</b>
            {canaisDoCaminho.map(nomeCanal).join(', ')}
          </span>
        </div>
        <div className="controles">
          <button className="botao primario" type="button" onClick={acoes.recomecar}>
            Ver de novo
          </button>
          <button className="botao" type="button" onClick={acoes.voltar}>
            Voltar e escolher outro caminho
          </button>
          <button className="botao" type="button" onClick={acoes.parar}>
            Fechar
          </button>
        </div>
      </div>
    );
  } else if (visual.pergunta) {
    const conexoes = new Map(doc.conexoes.map((c) => [c.id, c]));
    corpo = (
      <>
        <div className="pergunta">{nome(visual.pergunta.peca)}</div>
        <div className="opcoes">
          {visual.pergunta.opcoes.map((o, i) => (
            <button key={o.conexao} className="opcao" type="button" onClick={() => acoes.escolher(o.conexao)}>
              <span className="tecla">{conexoes.get(o.conexao)?.valor?.length === 1 ? conexoes.get(o.conexao)!.valor : i + 1}</span>
              <span>
                {o.texto}
                {o.sugerida && ' (o relógio iria por aqui)'}
                <small>
                  → {nome(o.para)}
                  {o.tempo_s ? ` · soma ${formatarTempo(o.tempo_s)}` : ''}
                </small>
              </span>
            </button>
          ))}
        </div>
        <p className="dica">
          Clica numa opção, no cano, ou aperta o número.{autoEscolha ? ` Segue sozinho em ${autoEscolha} s.` : ''}
        </p>
        {controles}
      </>
    );
  } else {
    corpo = (
      <>
        <div className="pergunta">{visual.correndo ? `Indo pra ${nome(doc.conexoes.find((c) => c.id === visual.correndo!.conexao)?.para)}` : nome(visual.atual)}</div>
        {controles}
      </>
    );
  }

  return (
    <div className="cartao-sim" role="region" aria-label="Simulação" style={{ ['--agua' as string]: corAgua(canal) }}>
      <div className="cab">
        <span className="pilula" style={{ ['--c' as string]: corAgua(canal) }}>
          <span className="ponto-cor" />
          {nomeCanal(canal)}
        </span>
        <span data-testid="tempo-cliente">tempo do cliente: {formatarTempo(visual.relogio_s)}</span>
      </div>
      <div className="quando">
        <label>
          Dia e hora
          <input type="datetime-local" value={play.quando} onChange={(e) => quandoValido(e.target.value) && acoes.quando(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={play.modo === 'relogio'} onChange={(e) => acoes.relogio(e.target.checked)} />o relógio decide os horários
        </label>
      </div>
      {corpo}
      <details className="det">
        <summary>Linha do tempo ({visual.linha.length})</summary>
        <ol className="linha-tempo">
          {visual.linha.map((l, i) => (
            <li key={i}>
              <time>{formatarTempo(l.relogio_s)}</time>
              <span>{nome(l.peca)}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
