/**
 * Regras de janela de funcionamento e utilitários de incidente de segurança.
 * Tudo é calculado com a hora do servidor convertida para America/Maceio,
 * então mexer no relógio do computador não libera o acesso.
 */

export const HORARIO = {
  tz: "America/Maceio",
  inicio: 8, // 08:00
  fimSemana: 18, // seg–qui: 18:00
  fimSexta: 17, // sexta: 17:00
} as const;

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

type MaceioNow = { dow: number; hour: number; minute: number; label: string };

/** Hora atual em Maceió, independente do fuso do servidor. */
export function maceioNow(at: Date = new Date()): MaceioNow {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: HORARIO.tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[get("weekday")] ?? 0;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    dow,
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** Hora de fechamento do dia (null = dia sem operação). */
export function fechamentoDoDia(dow: number): number | null {
  if (dow === 0 || dow === 6) return null;
  return dow === 5 ? HORARIO.fimSexta : HORARIO.fimSemana;
}

export type JanelaInfo = {
  aberto: boolean;
  agora: string;
  fechaAs: string | null;
  minutosParaFechar: number | null;
  proximaAbertura: string;
  motivo: "aberto" | "antes" | "depois" | "fim_de_semana";
};

export function avaliarJanela(at: Date = new Date()): JanelaInfo {
  const { dow, hour, minute, label } = maceioNow(at);
  const fecha = fechamentoDoDia(dow);
  const minutosAgora = hour * 60 + minute;

  const proximaAbertura = (() => {
    // Procura o próximo dia útil com horário disponível.
    for (let i = 0; i < 8; i++) {
      const d = (dow + i) % 7;
      const f = fechamentoDoDia(d);
      if (f === null) continue;
      if (i === 0) {
        if (minutosAgora < HORARIO.inicio * 60) return `hoje às 08:00`;
        if (minutosAgora < f * 60) return "agora";
        continue;
      }
      const nome = i === 1 ? "amanhã" : DIAS[d];
      return `${nome} às 08:00`;
    }
    return "segunda às 08:00";
  })();

  if (fecha === null) {
    return {
      aberto: false,
      agora: label,
      fechaAs: null,
      minutosParaFechar: null,
      proximaAbertura,
      motivo: "fim_de_semana",
    };
  }

  const fechaLabel = `${String(fecha).padStart(2, "0")}:00`;
  if (minutosAgora < HORARIO.inicio * 60) {
    return { aberto: false, agora: label, fechaAs: fechaLabel, minutosParaFechar: null, proximaAbertura, motivo: "antes" };
  }
  if (minutosAgora >= fecha * 60) {
    return { aberto: false, agora: label, fechaAs: fechaLabel, minutosParaFechar: 0, proximaAbertura, motivo: "depois" };
  }
  return {
    aberto: true,
    agora: label,
    fechaAs: fechaLabel,
    minutosParaFechar: fecha * 60 - minutosAgora,
    proximaAbertura: "agora",
    motivo: "aberto",
  };
}

/**
 * Dispara o e-mail de alerta de acesso simultâneo. Fica inativo (sem quebrar
 * nada) enquanto o domínio de envio não estiver configurado no projeto.
 */
export async function enviarEmailIncidente(input: {
  email: string | null;
  detalhes: Record<string, unknown>;
}): Promise<"enviado" | "sem_configuracao" | "erro"> {
  const key = process.env['RESEND_API_KEY'];
  const from = process.env['SECURITY_ALERT_FROM'];
  const to = process.env['SECURITY_ALERT_TO'];
  if (!key || !from || !to) return "sem_configuracao";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: to.split(",").map((t) => t.trim()),
        subject: `🚨 Acesso simultâneo detectado — ${input.email ?? "conta desconhecida"}`,
        html: `<h2>Acesso simultâneo bloqueado</h2>
<p>A conta <strong>${input.email ?? "(sem e-mail)"}</strong> foi acessada de dois dispositivos ao mesmo tempo. As duas sessões foram bloqueadas.</p>
<pre style="background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px">${JSON.stringify(input.detalhes, null, 2)}</pre>
<p>Libere a conta no painel administrativo, em RH → Acessos → Incidentes.</p>`,
      }),
    });
    return res.ok ? "enviado" : "erro";
  } catch {
    return "erro";
  }
}
