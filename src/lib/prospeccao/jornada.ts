// Cálculo puro do ritmo de prospecção do dia.
// A meta diária (padrão 250) é dividida pelo tempo útil da jornada, descontando
// o intervalo de almoço informado pela consultora.
export type Jornada = {
  inicio: string; // "08:00"
  fim: string; // "18:00"
  almoco_inicio: string; // "12:00"
  almoco_minutos: number;
  meta_diaria: number;
};

export const JORNADA_PADRAO: Jornada = {
  inicio: "08:00",
  fim: "18:00",
  almoco_inicio: "12:00",
  almoco_minutos: 60,
  meta_diaria: 250,
};

export function hhmmParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

export function minutosParaHhmm(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatarDuracao(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  if (h <= 0) return `${m}min`;
  return `${h}h ${String(m % 60).padStart(2, "0")}min`;
}

export type RitmoDia = {
  /** minutos úteis totais da jornada (sem o almoço) */
  minutosUteis: number;
  /** minutos úteis já decorridos */
  minutosDecorridos: number;
  /** minutos úteis que ainda restam hoje */
  minutosRestantes: number;
  /** quantas prospecções deveriam estar feitas neste momento */
  esperado: number;
  /** prospecções já registradas hoje */
  feitas: number;
  /** meta - feitas */
  faltam: number;
  /** ritmo necessário por hora para bater a meta com o tempo que resta */
  porHora: number;
  /** ritmo necessário a cada 10 minutos (mais palpável na operação) */
  por10min: number;
  /** percentual da meta concluída */
  pct: number;
  /** diferença em relação ao esperado (positivo = adiantada) */
  saldo: number;
  estado: "fora" | "almoco" | "em_dia" | "atras" | "adiantada" | "concluida";
  meta: number;
};

/**
 * @param agoraMin minutos desde a meia-noite no fuso local da consultora
 */
export function calcularRitmo(j: Jornada, agoraMin: number, feitas: number): RitmoDia {
  const inicio = hhmmParaMinutos(j.inicio);
  const fim = hhmmParaMinutos(j.fim);
  const almocoIni = hhmmParaMinutos(j.almoco_inicio);
  const almocoFim = almocoIni + Math.max(0, j.almoco_minutos);
  const meta = Math.max(1, j.meta_diaria);

  const almocoDentro = Math.max(
    0,
    Math.min(fim, almocoFim) - Math.max(inicio, almocoIni),
  );
  const minutosUteis = Math.max(1, fim - inicio - almocoDentro);

  const uteisAte = (t: number) => {
    const bruto = Math.min(Math.max(t, inicio), fim) - inicio;
    const almocoConsumido = Math.max(
      0,
      Math.min(Math.min(t, fim), almocoFim) - Math.max(inicio, almocoIni),
    );
    return Math.max(0, bruto - Math.max(0, almocoConsumido));
  };

  const minutosDecorridos = uteisAte(agoraMin);
  const minutosRestantes = Math.max(0, minutosUteis - minutosDecorridos);
  const esperado = Math.round((meta * minutosDecorridos) / minutosUteis);
  const faltam = Math.max(0, meta - feitas);
  const porHora = minutosRestantes > 0 ? Math.ceil((faltam / minutosRestantes) * 60) : faltam;
  const por10min = minutosRestantes > 0 ? Math.ceil((faltam / minutosRestantes) * 10) : faltam;
  const saldo = feitas - esperado;
  const pct = Math.min(100, Math.round((feitas / meta) * 100));

  let estado: RitmoDia["estado"];
  if (feitas >= meta) estado = "concluida";
  else if (agoraMin < inicio || agoraMin >= fim) estado = "fora";
  else if (agoraMin >= almocoIni && agoraMin < almocoFim) estado = "almoco";
  else if (saldo >= Math.ceil(meta * 0.03)) estado = "adiantada";
  else if (saldo <= -Math.ceil(meta * 0.03)) estado = "atras";
  else estado = "em_dia";

  return {
    minutosUteis,
    minutosDecorridos,
    minutosRestantes,
    esperado,
    feitas,
    faltam,
    porHora,
    por10min,
    pct,
    saldo,
    estado,
    meta,
  };
}

/** Minutos desde a meia-noite no fuso de Maceió (UTC-3), independente do fuso do dispositivo. */
export function agoraMinutosMaceio(d: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Maceio",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(d).split(":");
  return Number(h) * 60 + Number(m);
}

/** Blocos de 1 hora com a quantidade sugerida de prospecções, já sem o almoço. */
export function planoPorHora(j: Jornada): { faixa: string; alvo: number }[] {
  const inicio = hhmmParaMinutos(j.inicio);
  const fim = hhmmParaMinutos(j.fim);
  const almocoIni = hhmmParaMinutos(j.almoco_inicio);
  const almocoFim = almocoIni + Math.max(0, j.almoco_minutos);
  const meta = Math.max(1, j.meta_diaria);

  const blocos: { faixa: string; alvo: number }[] = [];
  let uteis = 0;
  const brutos: { ini: number; fimB: number; min: number }[] = [];
  for (let t = inicio; t < fim; t += 60) {
    const fimB = Math.min(t + 60, fim);
    const sobreposicao = Math.max(0, Math.min(fimB, almocoFim) - Math.max(t, almocoIni));
    const min = Math.max(0, fimB - t - sobreposicao);
    brutos.push({ ini: t, fimB, min });
    uteis += min;
  }
  for (const b of brutos) {
    blocos.push({
      faixa: `${minutosParaHhmm(b.ini)}–${minutosParaHhmm(b.fimB)}`,
      alvo: uteis > 0 ? Math.round((meta * b.min) / uteis) : 0,
    });
  }
  return blocos;
}
