'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Icone } from '@/componentes/Icone';
import type { NoMapa } from '@/mapa/montar';
import { useMapa } from './contexto';

export type NoFluxo = Node<{ no: NoMapa; semSaida: boolean }, 'ponto'>;

const ICONE_PECA: Record<string, string> = {
  audio: 'audio',
  menu: 'teclado',
  regra_horario: 'relogio',
  regra_feriado: 'calendario',
  consulta: 'banco',
  transferencia: 'transferir',
  atalho: 'seta',
  pesquisa: 'chat',
  fim: 'desliga',
};

const ICONE_TIPO: Record<string, string> = { fila: 'fila', grupo: 'fila', ramal: 'pessoa', fim: 'desliga', externo: 'telefone', inexistente: 'alerta' };

export function NoPonto({ data: { no, semSaida } }: NodeProps<NoFluxo>) {
  const { estado, tocar, irPara } = useMapa();
  const perguntando = estado.perguntando?.no === no.id;
  const aqui = estado.atual === no.id;
  const fimAqui = estado.fim?.no === no.id ? estado.fim.motivo : null;
  const alcas = (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );

  if (no.tipo === 'entrada' || no.tipo === 'ramais_diretos') {
    return (
      <div className={`entrada-no${aqui ? ' aceso' : ''}`} data-no={no.id}>
        {alcas}
        <Icone nome="telefone" />
        <button className="tocar" type="button" aria-label={`Dar play em ${no.titulo}`} onClick={() => tocar(no.id)}>
          <Icone nome={no.tipo === 'ramais_diretos' ? 'seta' : 'play'} />
        </button>
        <span className="rotulo">
          <b>{no.titulo}</b>
          {no.subtitulo && <span>{no.subtitulo}</span>}
        </span>
      </div>
    );
  }

  if (no.tipo === 'atalho') {
    return (
      <button type="button" className={`atalho-no${no.atalho?.volta ? ' volta' : ''}`} data-no={no.id} onClick={() => irPara(no.atalho!.alvo)} aria-label={`Ir até ${no.titulo}`}>
        {alcas}
        <Icone nome={no.atalho?.volta ? 'volta' : 'seta'} />
        <span className="rotulo">
          {no.atalho?.volta ? 'volta pra' : 'segue em'}
          <b>{no.titulo}</b>
        </span>
      </button>
    );
  }

  const classes = [
    'ponto',
    `t-${no.tipo}`,
    no.tipoPeca && `p-${no.tipoPeca}`,
    no.canal && `c-${no.canal}`,
    no.inativo && 'inativo',
    perguntando && 'perguntando',
    aqui && !perguntando && 'aceso',
    no.tipo === 'fila' && estado.visitados.has(no.id) && 'cheia',
    fimAqui === 'atendido' && 'atendido',
    fimAqui && ['desistiu', 'incompleta'].includes(fimAqui) && 'alarme',
    fimAqui && ['beco', 'destino_inexistente', 'ciclo'].includes(fimAqui) && 'morto',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} data-no={no.id}>
      {alcas}
      {no.tipo === 'fila' && <span className="nivel" />}
      {no.selo && <span className="etiqueta">{no.selo}</span>}
      <span className="ladrilho">
        <Icone nome={no.tipoPeca ? ICONE_PECA[no.tipoPeca]! : ICONE_TIPO[no.tipo] ?? 'seta'} />
      </span>
      <span className="textos">
        <span className="titulo" title={no.titulo}>
          {no.titulo}
        </span>
        {no.subtitulo && <span className="sub">{no.subtitulo}</span>}
      </span>
      {no.decisao && <span className="valvula" aria-hidden="true" />}
      {semSaida && <span className="cano-quebrado" aria-label="sem saída" />}
    </div>
  );
}

export type NoFaixaFluxo = Node<{ titulo: string; subtitulo?: string }, 'faixa'>;

export function NoFaixa({ data }: NodeProps<NoFaixaFluxo>) {
  return (
    <div className="faixa">
      <b>{data.titulo}</b>
      {data.subtitulo && <span>{data.subtitulo}</span>}
    </div>
  );
}
