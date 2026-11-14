import './landing.css';
import { Marca } from '@/componentes/Marca';
import { destinoDaLanding, jeitosDeEntrar } from '@/lib/acesso';
import { BotaoDeEntrar } from './BotaoDeEntrar';
import { Exemplos } from './Exemplos';
import { FluxoAbertura } from './FluxoAbertura';

/**
 * Os ícones do "O que o play mostra", no estilo das peças do editor (tile claro, traço --ink-2), em 24×24. O `detalhe`
 * é o único traço na cor do problema.
 */
const DORES = [
  {
    titulo: 'O cliente que volta pro menu sem parar.',
    texto:
      'A URA que repete “não entendi”, o chamado que passa de setor em setor. No play, tu vê o caminho voltar pro mesmo lugar; quando ele volta sozinho, sem ninguém escolher, o diagnóstico marca o ciclo.',
    cor: 'loop',
    icone: 'M3.5 8H11',
    detalhe: 'M11 8h4.5a4 4 0 0 1 0 8H9 M11.5 13.5 9 16l2.5 2.5',
  },
  {
    titulo: 'A opção que não leva a lugar nenhum.',
    texto:
      'Opção 9 da URA, ligação fora do horário, caixa de e-mail sem dono. A água chega e não tem pra onde ir: tu vê o cano sem saída antes do cliente achar.',
    cor: 'bad',
    icone: 'M3.5 6.5H12a4 4 0 0 1 4 4v1.5',
    detalhe: 'M16 15.5v.01 M16 20v.01',
  },
  {
    titulo: 'A espera que ninguém mede.',
    texto: 'Cada etapa tem um tempo, e o play soma o do cliente até o fim. Quando passa da meta, o Journey diz por qual caminho.',
    cor: 'warn',
    icone: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z',
    detalhe: 'M12 8v4l3 2',
  },
  {
    titulo: 'O fluxograma que ninguém atualiza.',
    texto: 'O desenho é o fluxo de verdade: muda num lugar e todo mundo vê. As versões guardam como era antes de cada mudança.',
    cor: 'info',
    icone: 'M8.5 3.5h11v13h-11z M11.5 7.5h5 M11.5 10.5h5',
    detalhe: 'M5 7.5v13h11',
  },
] as const;

const PASSOS = [
  { titulo: 'Desenha.', texto: 'Arrasta as peças: início, mensagem, decisão, atendimento e fim. Cada canal tem a sua cor. Ou começa de um modelo pronto.' },
  { titulo: 'Dá play.', texto: 'A água sai do início, para em cada decisão pra tu escolher o caminho e conta o tempo do cliente até o fim.' },
  { titulo: 'Compartilha.', texto: 'Manda um link só de leitura pra diretoria ou pro cliente, com o caminho já tocando.' },
];

const PUBLICOS = [
  {
    titulo: 'Atendimento e CX.',
    texto: 'Pra ver o caminho do cliente em todos os canais antes de mexer na operação.',
    lista: [
      'URA de telefonia e horário de atendimento',
      'bot de WhatsApp e transbordo pro humano',
      'SAC por e-mail e chat do site',
      'filas, tempo de espera e meta de atendimento',
    ],
  },
  {
    titulo: 'Processos internos.',
    texto: 'Pra desenhar esteiras com várias áreas e ver onde o pedido para.',
    lista: ['aprovação de compras e de despesas', 'esteira de crédito com análise manual', 'onboarding de cliente', 'chamados de TI entre níveis'],
  },
];

/**
 * A landing: o que quem chega sem sessão vê na raiz. Uma tarefa: levar a pessoa a criar a conta. A abertura mostra o
 * produto (o fluxo desenhado à mão, leve); os exemplos trazem o visualizador de verdade, só quando a pessoa rola até
 * eles. O resto é texto e CSS (landing.css), sem nada do editor.
 */
export function Landing() {
  const jeitos = jeitosDeEntrar(process.env.NEXT_PUBLIC_LOGIN_GOOGLE, process.env.NEXT_PUBLIC_LOGIN_EMAIL);
  const chamada = destinoDaLanding('chamada', jeitos);
  const botaoChamada = <BotaoDeEntrar destino={chamada} rotulo={chamada.tipo === 'google' ? 'Continuar com o Google' : 'Criar conta'} jeito="google" />;

  return (
    <div className="landing">
      <header className="l-barra">
        <div className="l-largura">
          <Marca href={null} />
          <nav aria-label="Atalhos da página">
            <a href="#exemplos">Exemplos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#pra-quem">Pra quem</a>
          </nav>
          <div className="l-conta">
            <BotaoDeEntrar destino={destinoDaLanding('entrar', jeitos)} rotulo="Entrar" jeito="texto" />
            <BotaoDeEntrar destino={destinoDaLanding('criar', jeitos)} rotulo="Criar conta" jeito="pilula" />
          </div>
        </div>
      </header>
      <main>
        {/* A abertura, no pontilhado do quadro (o único lugar da página com ele). */}
        <section className="l-abertura" aria-labelledby="titulo-abertura">
          <div className="l-largura">
            <div className="l-chamada">
              <h1 id="titulo-abertura">Desenha o fluxo e dá play.</h1>
              <p className="l-lead">
                Teu atendimento e teus processos num quadro só. No play, a água mostra por onde o cliente passa, onde espera demais e onde ele se perde.
              </p>
              <div className="l-acoes">
                {botaoChamada}
                <a className="l-sublinhado" href="#exemplos">
                  Ver exemplos
                </a>
              </div>
            </div>
            <FluxoAbertura />
          </div>
        </section>

        <section className="l-secao l-largura" id="exemplos" aria-labelledby="titulo-exemplos">
          <div className="l-cabeca">
            <h2 id="titulo-exemplos">Um fluxo pra cada operação</h2>
            <p>Escolhe um exemplo e dá play. Tu escolhe o caminho em cada decisão, e o diagnóstico aponta o que está errado.</p>
          </div>
          <Exemplos />
        </section>

        <section className="l-secao l-largura" aria-labelledby="titulo-mostra">
          <div className="l-cabeca">
            <h2 id="titulo-mostra">O que o play mostra e o fluxograma esconde</h2>
            <p>Fluxo desenhado em slide parece sempre certo. Com a água passando, os problemas aparecem sozinhos.</p>
          </div>
          <ul className="l-dores">
            {DORES.map((d) => (
              <li key={d.titulo}>
                <svg className={`l-icone ${d.cor}`} viewBox="0 0 24 24" aria-hidden="true">
                  <path d={d.icone} />
                  <path className={d.cor === 'bad' ? 'l-gotas' : 'l-detalhe'} d={d.detalhe} />
                </svg>
                <div>
                  <h3>{d.titulo}</h3>
                  <p>{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="l-secao l-largura" id="como-funciona" aria-labelledby="titulo-como">
          <div className="l-cabeca">
            <h2 id="titulo-como">Como funciona</h2>
          </div>
          <ol className="l-passos">
            {PASSOS.map((p, i) => (
              <li key={p.titulo}>
                <span className="l-numero" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="l-secao l-largura" id="pra-quem" aria-labelledby="titulo-quem">
          <div className="l-cabeca">
            <h2 id="titulo-quem">Pra quem cuida de fluxo</h2>
          </div>
          <div className="l-publicos">
            {PUBLICOS.map((p) => (
              <article key={p.titulo} className="l-publico">
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
                <ul>
                  {p.lista.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="l-fecho l-largura" aria-labelledby="titulo-fecho">
          <h2 id="titulo-fecho">Play your journey.</h2>
          <p>{chamada.tipo === 'google' ? 'Entra com o Google e desenha' : 'Desenha'} o primeiro fluxo em minutos, do zero ou a partir de um modelo pronto.</p>
          <div className="l-acoes">{botaoChamada}</div>
        </section>
      </main>

      <footer className="l-rodape">
        <div className="l-largura">
          <Marca href={null} />
          <span>Desenha o fluxo e dá play.</span>
        </div>
      </footer>
    </div>
  );
}
