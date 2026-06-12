import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { registrarAtividade } from "@/lib/positiva/positiva.functions";
import { toast } from "sonner";
import { Bot, Flame } from "lucide-react";
import type { AtividadeTipo } from "@/lib/positiva/constants";

// Intervalo entre cobranças (ms). Padrão: 25 min.
const INTERVALO_MS = 25 * 60 * 1000;
// Primeiro pop-up após entrar (ms).
const PRIMEIRO_MS = 30 * 1000;
const LS_KEY = "positiva_cobranca_last";

type Cobranca = {
  tipo: AtividadeTipo;
  titulo: string;
  pergunta: string;
  placeholder: string;
  // reação agressiva baseada no número informado
  reacao: (n: number) => string;
};

const COBRANCAS: Cobranca[] = [
  {
    tipo: "ligacao",
    titulo: "Quantas LIGAÇÕES até agora?",
    pergunta: "Me fala o número AGORA. Quem não liga, não fatura. O telefone é sua arma.",
    placeholder: "Nº de ligações feitas",
    reacao: (n) =>
      n <= 0
        ? "ZERO?! Levanta e pega o telefone JÁ. Ninguém vende parado. Liga AGORA."
        : n < 10
          ? `${n} é pouco. Dobra isso até o próximo pulso. Acelera, o dia não espera!`
          : `${n} ligações! Esse é o ritmo. Mantém a pressão e transforma em agendamento.`,
  },
  {
    tipo: "agendamento",
    titulo: "Quantos AGENDAMENTOS fechou?",
    pergunta: "Agenda cheia é venda garantida. Quantos compromissos você travou hoje?",
    placeholder: "Nº de agendamentos",
    reacao: (n) =>
      n <= 0
        ? "Sem agendamento não tem venda. Liga, qualifica e MARCA. Quero número na próxima."
        : n < 3
          ? `${n}? Dá pra mais. Cada ligação tem que terminar com data marcada. Bora!`
          : `${n} na agenda! Agora é confirmar, preparar o script e FECHAR cada um.`,
  },
  {
    tipo: "proposta",
    titulo: "Quantas POSSÍVEIS VENDAS na mesa?",
    pergunta: "Quantas propostas estão quentes pra fechar? Não deixa esfriar nenhuma.",
    placeholder: "Nº de possíveis vendas",
    reacao: (n) =>
      n <= 0
        ? "Nenhuma quente? Então é hora de gerar oportunidade. Reativa e propõe AGORA."
        : `${n} na mesa. Liga em TODAS hoje. Proposta parada é dinheiro saindo do seu bolso.`,
  },
  {
    tipo: "contrato",
    titulo: "Quantas VENDAS bateram hoje?",
    pergunta: "O placar do dia. Quantos contratos você FECHOU? Sem desculpa.",
    placeholder: "Nº de vendas fechadas",
    reacao: (n) =>
      n <= 0
        ? "Zero contrato é inaceitável. Pega a proposta mais quente e FECHA antes do fim do dia."
        : `${n} FECHADAS! 🔥 Agora não para — vai atrás da próxima. Campeão não desacelera.`,
  },
];

export function PositivaCobrancaPopup() {
  const { user, loading } = useAuth();
  const registrar = useServerFn(registrarAtividade);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [valor, setValor] = useState("");
  const [reacao, setReacao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cobranca = COBRANCAS[idx % COBRANCAS.length];

  const agendarProxima = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIdx((i) => i + 1);
      setValor("");
      setReacao(null);
      setOpen(true);
      try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* ignore */ }
    }, ms);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let last = 0;
    try { last = Number(localStorage.getItem(LS_KEY) || 0); } catch { /* ignore */ }
    const elapsed = Date.now() - last;
    const espera = last && elapsed < INTERVALO_MS ? INTERVALO_MS - elapsed : PRIMEIRO_MS;
    agendarProxima(espera);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading, user, agendarProxima]);

  if (loading || !user) return null;

  const enviar = async () => {
    const n = Math.max(0, Math.floor(Number(valor)) || 0);
    setSalvando(true);
    try {
      if (n > 0) await registrar({ data: { tipo: cobranca.tipo, quantidade: n } });
      setReacao(cobranca.reacao(n));
      if (n > 0) toast.success("Registrado! Bora pra cima 🔥");
    } catch {
      setReacao(cobranca.reacao(n));
    } finally {
      setSalvando(false);
    }
  };

  const fechar = () => {
    setOpen(false);
    agendarProxima(INTERVALO_MS);
    try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Flame className="h-3.5 w-3.5" /> POSITIVA IA · Cobrança
            </span>
          </div>
          <DialogTitle className="text-xl">{cobranca.titulo}</DialogTitle>
          <DialogDescription className="text-sm">{cobranca.pergunta}</DialogDescription>
        </DialogHeader>

        {reacao ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm font-medium">
            {reacao}
          </div>
        ) : (
          <Input
            autoFocus
            type="number"
            min={0}
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={cobranca.placeholder}
            onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
          />
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {reacao ? (
            <Button onClick={fechar} className="w-full">Bora pra cima 🚀</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={fechar}>Agora não</Button>
              <Button onClick={enviar} disabled={salvando}>
                {salvando ? "Registrando…" : "Registrar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
