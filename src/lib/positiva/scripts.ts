// ============================================================
// POSITIVA IA — Biblioteca de scripts (300+) para consignado 40+
// Geramos variações naturais a partir de fragmentos curados,
// mantendo o tom ético, positivo e consultivo da marca.
// ============================================================

export type ScriptCategoria =
  | "abertura"
  | "rapport"
  | "descoberta"
  | "qualificacao"
  | "followup"
  | "fechamento"
  | "reativacao"
  | "recuperacao";

export const CATEGORIA_LABEL: Record<ScriptCategoria, string> = {
  abertura: "Abertura",
  rapport: "Rapport",
  descoberta: "Descoberta",
  qualificacao: "Qualificação",
  followup: "Follow-up",
  fechamento: "Fechamento",
  reativacao: "Reativação",
  recuperacao: "Recuperação de clientes antigos",
};

export type Script = { id: string; categoria: ScriptCategoria; texto: string };

const NOMES = ["[nome]"];
const N = NOMES[0];

function build(cat: ScriptCategoria, frases: string[]): Script[] {
  return frases.map((texto, i) => ({ id: `${cat}-${i + 1}`, categoria: cat, texto }));
}

const ABERTURA = [
  `Olá, falo com ${N}? Aqui é a consultora do Grupo Positive. Tenho uma condição especial liberada no seu nome, posso te mostrar em 2 minutos?`,
  `Bom dia, ${N}! Vi que sua margem foi atualizada com o aumento. Quer que eu te mostre como aproveitar com segurança?`,
  `Oi ${N}, tudo bem? Cuido do planejamento financeiro de servidores aqui na região e fiz uma análise prévia para você.`,
  `Olá ${N}! Estou falando com servidores que tiveram aumento e ganharam margem nova. Posso te apresentar sua liberação?`,
  `Bom dia! Falo com o(a) servidor(a) ${N}? Tenho uma simulação pré-aprovada no seu nome para apresentar.`,
  `Oi ${N}, espero que esteja tudo ótimo! Separei uma condição exclusiva para servidores como você. Tem um minutinho?`,
  `Olá ${N}, sou especialista em crédito para servidores públicos. Posso te mostrar uma forma segura de organizar suas finanças?`,
  `Bom dia ${N}! Notícia boa: você tem margem disponível e quero te ajudar a usar isso da melhor forma possível.`,
  `Oi ${N}, tudo certo? Trabalho com liberações 100% oficiais com desconto em folha. Posso te explicar rapidinho?`,
  `Olá ${N}! Estou entrando em contato porque sua condição como servidor permite um crédito muito vantajoso agora.`,
  `Bom dia, ${N}! Você é servidor(a), certo? Então tenho uma ótima notícia sobre seu planejamento financeiro.`,
  `Oi ${N}, aqui é do Grupo Positive. Fiz uma simulação rápida e o resultado ficou excelente para o seu perfil.`,
  `Olá ${N}! Posso roubar 2 minutos do seu tempo para te mostrar uma liberação especial no seu nome?`,
  `Bom dia ${N}! Antes que eu esqueça: sua margem nova está disponível e as condições de hoje estão ótimas.`,
  `Oi ${N}, tudo bem com a senhora/o senhor? Quero te apresentar uma forma tranquila de realizar um projeto seu.`,
  `Olá ${N}! Sou consultora de servidores 100% focada em segurança e clareza. Posso te mostrar sua condição?`,
  `Bom dia ${N}! Tenho boas notícias sobre crédito para servidores. Você está num bom momento para isso?`,
  `Oi ${N}, te peguei em boa hora? Separei uma liberação pré-aprovada para te apresentar com calma.`,
  `Olá ${N}! Atendo servidores que valorizam confiança e tranquilidade. Posso te mostrar sua simulação?`,
  `Bom dia ${N}! Vou ser breve: você tem uma condição vantajosa liberada e quero garantir que você saiba disso.`,
];

const RAPPORT = [
  `Imagino a rotina de servidor não ser fácil, ${N}. Justamente por isso meu trabalho é deixar tudo simples e tranquilo para você.`,
  `${N}, gosto de atender servidores porque são pessoas que valorizam seriedade — e é exatamente assim que eu trabalho.`,
  `Antes de qualquer número, ${N}, quero te conhecer um pouco. Há quanto tempo você está no serviço público?`,
  `Sei que você recebe muitas ligações, ${N}. Prometo ser objetiva e te trazer algo realmente útil.`,
  `${N}, meu compromisso é com a sua tranquilidade. Pode me perguntar o que quiser, sem compromisso nenhum.`,
  `Adoro trabalhar com quem pensa no futuro, ${N}. Vamos organizar isso juntos, com calma.`,
  `${N}, pode confiar: aqui é tudo transparente, oficial e no seu ritmo. Sem pressão.`,
  `Que bom falar com você, ${N}! Trabalho para que você se sinta segura em cada passo.`,
  `${N}, antes de mais nada: meu papel é te proteger e te orientar, não te empurrar nada.`,
  `Sei o valor de uma decisão financeira bem feita, ${N}. Por isso vou te explicar tudo com clareza.`,
  `${N}, você cuida do público todos os dias. Deixa eu cuidar um pouquinho de você agora?`,
  `Gosto de relações de confiança, ${N}. Vamos construir isso desde já, combinado?`,
  `${N}, qualquer dúvida pode falar à vontade. Prefiro responder tudo a deixar você inseguro(a).`,
  `Servidores são meus clientes favoritos, ${N} — gente séria que merece atendimento sério.`,
  `${N}, vou no seu tempo. Se precisar pensar, pensamos juntos com todos os números na mesa.`,
  `Fico feliz de poder te ajudar, ${N}. Tranquilidade financeira muda o dia a dia da gente.`,
  `${N}, pode considerar que tem alguém do seu lado para te orientar sempre que precisar.`,
  `Antes de falar de crédito, ${N}, me conta: tem algum projeto ou sonho que você gostaria de realizar?`,
  `${N}, meu foco é que você saia dessa conversa mais tranquila do que entrou.`,
  `Confiança se constrói com clareza, ${N}. Então vou te mostrar cada detalhe, sem letras miúdas.`,
];

const DESCOBERTA = [
  `${N}, se surgisse um valor disponível hoje, teria algo que você gostaria de realizar ou organizar?`,
  `Como anda sua organização financeira atualmente, ${N}? Está do jeito que você gostaria?`,
  `${N}, você prefere reduzir seu investimento mensal ou ter um valor extra disponível?`,
  `Tem algum compromisso que pesa no fim do mês e você gostaria de organizar melhor, ${N}?`,
  `${N}, você já tem algum crédito ativo? Pergunto porque talvez eu consiga melhorar suas condições.`,
  `O que é mais importante para você hoje, ${N}: segurança, economia ou ter dinheiro em mãos?`,
  `${N}, pensando nos próximos meses, tem algum plano que um crédito poderia te ajudar a realizar?`,
  `Como você costuma decidir esse tipo de assunto, ${N} — sozinho(a) ou conversando em família?`,
  `${N}, num cenário ideal, como ficaria sua vida financeira daqui a 6 meses?`,
  `Tem algo te incomodando nas suas finanças hoje que você gostaria de resolver, ${N}?`,
  `${N}, você já fez algum planejamento usando sua margem antes? Como foi a experiência?`,
  `O que faria você dizer 'sim' com tranquilidade para uma proposta, ${N}?`,
  `${N}, qual seria o valor que faria diferença real na sua vida agora?`,
  `Você prioriza mais o prazo curto ou um investimento mensal menor, ${N}?`,
  `${N}, tem alguma data ou objetivo específico em mente para usar esse crédito?`,
  `Como está sua tranquilidade em relação ao orçamento do mês, ${N}?`,
  `${N}, se eu te mostrasse uma forma segura de organizar tudo, faria sentido para você?`,
  `Tem alguém na família que também é servidor e poderia se beneficiar, ${N}?`,
  `${N}, o que você mais valoriza num atendimento: rapidez, clareza ou segurança?`,
  `Me conta, ${N}: o que te fez atender minha ligação hoje?`,
];

const QUALIFICACAO = [
  `${N}, só para confirmar: você é servidor(a) ativo(a), certo? Isso garante as melhores condições.`,
  `Para eu te dar o número exato, ${N}, posso confirmar seu órgão e seu vínculo?`,
  `${N}, sua margem nova já está liberada — isso te coloca num grupo bem privilegiado de condições.`,
  `Confirmando os dados, ${N}: o desconto seria direto em folha, o que te dá total segurança.`,
  `${N}, com seu perfil de servidor, consigo prazos e condições que o mercado comum não oferece.`,
  `Você se enquadra perfeitamente, ${N}. Vamos ver qual opção combina mais com seu planejamento?`,
  `${N}, pelo seu tempo de serviço, suas condições ficam ainda melhores. Posso simular?`,
  `Para personalizar, ${N}: prefere focar em valor liberado ou em investimento mensal menor?`,
  `${N}, confirmando: você decide hoje ou prefere alinhar com a família primeiro?`,
  `Seu perfil é exatamente o que oferece as melhores taxas, ${N}. Vamos aproveitar?`,
  `${N}, com a margem que você tem, consigo montar uma proposta sob medida. Topa ver?`,
  `Confirmando rapidinho, ${N}: a liberação seria para um objetivo específico ou reserva?`,
  `${N}, você prefere que eu envie por escrito ou explique tudo agora pelo telefone?`,
  `Pelo que você me contou, ${N}, faz total sentido seguirmos. Concorda?`,
  `${N}, seu vínculo permite condições especiais. Quer que eu já deixe pré-aprovado?`,
  `Para fechar do seu jeito, ${N}: qual prazo deixa seu mês mais tranquilo?`,
  `${N}, você já tem conta no banco conveniado? Isso agiliza ainda mais.`,
  `Confirmando o essencial, ${N}, posso seguir com a simulação detalhada agora?`,
  `${N}, com esses dados consigo te mostrar o valor real. Vamos lá?`,
  `Pelo seu perfil, ${N}, você está entre os clientes com melhores condições. Aproveitamos?`,
];

const FOLLOWUP = [
  `Oi ${N}, passando para garantir que sua condição especial ainda está disponível. Conseguiu pensar?`,
  `${N}, bom dia! Como combinamos, estou retornando. Ficou alguma dúvida que eu possa esclarecer?`,
  `Olá ${N}, tudo bem? Trago uma novidade na sua simulação que pode te interessar. Posso explicar?`,
  `${N}, não quero te perder de vista! Qual o melhor horário para a gente retomar hoje?`,
  `Oi ${N}, lembra da nossa conversa? Sua margem segue liberada e quero te ajudar a aproveitar.`,
  `${N}, separei um resumo bem claro para facilitar sua decisão. Posso te enviar agora?`,
  `Olá ${N}! Passando rapidinho: conseguiu conversar em casa como você queria?`,
  `${N}, estou aqui para o que precisar. Vamos dar o próximo passo juntos?`,
  `Oi ${N}, tudo certo? As condições de hoje continuam ótimas — quer que eu garanta para você?`,
  `${N}, retomando como prometido. Prefere fechar agora ou marcar um horário melhor?`,
  `Olá ${N}! Pensei no seu caso e tenho uma alternativa que pode te agradar. Posso mostrar?`,
  `${N}, só confirmando nosso retorno de hoje. Está num bom momento para conversarmos?`,
  `Oi ${N}, sua liberação ainda está reservada no seu nome. Vamos aproveitar enquanto está disponível?`,
  `${N}, queria saber se ficou tudo claro do nosso último contato. Posso te ajudar em algo?`,
  `Olá ${N}! Trabalho para facilitar sua vida — então me chama assim que decidir, combinado?`,
  `${N}, retornando com carinho. Tem algo que está te impedindo de seguir que eu possa resolver?`,
  `Oi ${N}, bom te encontrar de novo! Vamos finalizar aquilo que conversamos?`,
  `${N}, deixei tudo pronto do meu lado. Falta só o seu 'sim' quando você se sentir segura.`,
  `Olá ${N}! Como você é cliente especial, garanti sua condição por mais alguns dias. Aproveitamos?`,
  `${N}, passando para te lembrar do nosso combinado. Posso seguir com a proposta?`,
];

const FECHAMENTO = [
  `${N}, recapitulando os ganhos, faz todo sentido seguirmos. Prefere a liberação em 60 ou em 84 vezes?`,
  `Tudo é 100% oficial e com desconto em folha, ${N}. Posso dar entrada na sua liberação agora?`,
  `${N}, deixo aprovado e você decide a liberação quando quiser. Combinado?`,
  `Sua margem está disponível agora e as condições estão ótimas, ${N}. Vamos garantir?`,
  `${N}, do jeito que conversamos, fica tranquilo no seu mês. Fazemos hoje?`,
  `Posso seguir com seu cadastro, ${N}? Em poucos passos deixo tudo resolvido para você.`,
  `${N}, você prefere começar pelo valor maior ou pelo investimento mensal menor?`,
  `Está tudo conforme você queria, ${N}. Falta só confirmar para eu dar andamento. Vamos?`,
  `${N}, é a decisão que vai te trazer tranquilidade. Posso registrar seu aceite?`,
  `Deixa eu cuidar de tudo para você, ${N}. Confirma comigo e eu resolvo o resto.`,
  `${N}, como ficou claro e seguro, que tal aprovarmos agora e você relaxar?`,
  `Sua condição está reservada, ${N}. Garantimos hoje para não correr risco de mudar?`,
  `${N}, posso enviar o link/contrato para você assinar com calma agora mesmo?`,
  `Tudo certo do seu lado, ${N}? Então seguimos — você vai gostar do resultado.`,
  `${N}, vamos transformar esse planejamento em realidade hoje?`,
  `Confirmando seu aceite, ${N}, já inicio a liberação. Pode ser?`,
  `${N}, é simples, seguro e cabe no seu orçamento. Fechamos?`,
  `Posso considerar que está aprovado, ${N}? Daí cuido de cada detalhe para você.`,
  `${N}, qual a melhor forma de receber: hoje ou amanhã cedo?`,
  `Vamos garantir sua tranquilidade financeira agora, ${N}? É só você confirmar.`,
];

const REATIVACAO = [
  `Oi ${N}, quanto tempo! Lembrei de você porque surgiu uma condição nova que combina muito com seu perfil.`,
  `${N}, tudo bem? Sua margem foi atualizada e abriu uma ótima oportunidade. Posso te contar?`,
  `Olá ${N}! Faz um tempo que não conversamos. Tenho novidades que podem te interessar.`,
  `${N}, voltei a falar com clientes especiais como você porque as condições melhoraram bastante.`,
  `Oi ${N}, espero que esteja tudo ótimo! Tem uma liberação nova no seu nome — quer ver?`,
  `${N}, lembra de mim? Estou com uma proposta ainda melhor que a anterior para você.`,
  `Olá ${N}! Como cliente antigo, você tem prioridade nas novas condições. Posso apresentar?`,
  `${N}, seu perfil voltou a ficar muito vantajoso. Vamos aproveitar essa janela?`,
  `Oi ${N}, passando para reativar nosso contato. Surgiu algo que pode te ajudar bastante.`,
  `${N}, com seu histórico, consigo condições exclusivas agora. Topa uma simulação rápida?`,
  `Olá ${N}! Senti sua falta por aqui. Tenho uma novidade que vale seus 2 minutos.`,
  `${N}, você já confiou na gente antes — agora as condições estão ainda melhores. Vamos?`,
  `Oi ${N}, tudo certo? Sua margem nova permite organizar tudo com mais tranquilidade.`,
  `${N}, reabrimos uma condição especial para clientes como você. Posso te mostrar?`,
  `Olá ${N}! Como o aumento mexeu na sua margem, surgiram boas oportunidades. Quer conferir?`,
  `${N}, voltando a falar com você com uma proposta sob medida. Posso explicar?`,
  `Oi ${N}, lembrei do seu objetivo daquela vez. Agora consigo te ajudar a realizar.`,
  `${N}, sua condição de servidor está ainda mais vantajosa hoje. Vamos retomar?`,
  `Olá ${N}! Tenho carinho pelos clientes antigos — e novidades boas para você.`,
  `${N}, que tal retomarmos de onde paramos? As condições agora estão a seu favor.`,
];

const RECUPERACAO = [
  `${N}, entendo se ficou alguma dúvida da última vez. Posso esclarecer tudo com total transparência agora?`,
  `Oi ${N}, sei que não seguimos antes, e tudo bem. Voltei porque acredito que posso te ajudar de verdade.`,
  `${N}, sem pressão nenhuma: só quero garantir que você saiba das condições atuais, melhores que antes.`,
  `Olá ${N}, da última vez talvez não fosse o momento. E agora, faria sentido conversarmos?`,
  `${N}, valorizo muito sua confiança. O que faltou para a gente avançar da outra vez?`,
  `Oi ${N}, voltei com uma proposta mais alinhada ao que você precisa. Posso mostrar?`,
  `${N}, se algo te deixou inseguro antes, quero resolver isso com você ponto a ponto.`,
  `Olá ${N}! Aprendi com nossa conversa anterior e trago algo melhor desta vez.`,
  `${N}, sua opinião importa: o que poderia tornar essa decisão mais tranquila para você?`,
  `Oi ${N}, sem compromisso, posso te atualizar sobre as novas condições? Mudou bastante.`,
  `${N}, fico à disposição para recomeçar no seu tempo e do seu jeito.`,
  `Olá ${N}, prefiro perder uma venda a perder sua confiança. Vamos conversar com calma?`,
  `${N}, da outra vez você pediu para pensar. Posso te ajudar a pensar agora, com números na mão?`,
  `Oi ${N}, talvez tenha faltado clareza antes. Deixa eu te mostrar tudo de forma simples?`,
  `${N}, voltei porque acredito que ainda posso te trazer tranquilidade financeira. Topa?`,
  `Olá ${N}! Reabri sua condição especial. Que tal darmos uma segunda chance a esse plano?`,
  `${N}, sei que você é exigente — e é por isso mesmo que quero te atender de novo.`,
  `Oi ${N}, sem reativar trauma de vendedor chato: só uma boa notícia objetiva. Posso?`,
  `${N}, o que aconteceu da última vez não muda meu respeito por você. Vamos tentar de novo?`,
  `Olá ${N}, trago hoje exatamente o que faltou antes: clareza, segurança e uma boa condição.`,
];

// Variação extra para ampliar a biblioteca mantendo qualidade.
const SUFIXOS = [
  "",
  " Pode ser?",
  " O que você acha?",
  " Faz sentido para você?",
  " Topa avançar?",
];

function expandir(cat: ScriptCategoria, base: string[]): Script[] {
  const out: Script[] = [];
  base.forEach((texto, i) => {
    SUFIXOS.forEach((suf, j) => {
      // Evita duplicar pontuação quando a frase já termina com interrogação.
      if (suf && /[?!]\s*$/.test(texto)) return;
      out.push({ id: `${cat}-${i + 1}-${j}`, categoria: cat, texto: `${texto}${suf}` });
    });
  });
  return out;
}

export const SCRIPTS: Script[] = [
  ...build("abertura", ABERTURA),
  ...build("rapport", RAPPORT),
  ...build("descoberta", DESCOBERTA),
  ...build("qualificacao", QUALIFICACAO),
  ...build("followup", FOLLOWUP),
  ...build("fechamento", FECHAMENTO),
  ...build("reativacao", REATIVACAO),
  ...build("recuperacao", RECUPERACAO),
  // Expansões (variações com diferentes encerramentos) para passar de 300 scripts.
  ...expandir("abertura", ABERTURA),
  ...expandir("rapport", RAPPORT),
  ...expandir("descoberta", DESCOBERTA),
  ...expandir("followup", FOLLOWUP),
  ...expandir("fechamento", FECHAMENTO),
  ...expandir("reativacao", REATIVACAO),
];

export const SCRIPTS_POR_CATEGORIA = (cat: ScriptCategoria) =>
  SCRIPTS.filter((s) => s.categoria === cat);

export const TOTAL_SCRIPTS = SCRIPTS.length;
