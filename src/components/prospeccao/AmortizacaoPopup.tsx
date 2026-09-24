// Aviso do dia da amortização: só some quando a consultora registra o
// resultado da ligação ou reagenda para o próximo mês.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PiggyBank, Phone, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { whatsappLink } from "@/lib/prospeccao/constants";
import { esteiraListar, esteiraRegistrarContato, type EsteiraContrato } from "@/lib/prospeccao/esteira.functions";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const DISPENSADO_KEY = "amortizacao-popup-dispensado";
const SOM_KEY = "amortizacao-popup-som";

const RESULTADOS = [
  { value: "amortizou", label: "Amortizou" },
  { value: "falei", label: "Falei com o cliente" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "nao_quis", label: "Não quis agora" },
] as const;

function toque() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(760, ctx.currentTime);
    osc.frequency.setValueAtTime(980, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* navegadores que bloqueiam áudio */
  }
}

export function AmortizacaoPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listar = useServerFn(esteiraListar);
  const registrar = useServerFn(esteiraRegistrarContato);
  const [open, setOpen] = useState(false);
  const [tocou, setTocou] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["esteira", "avisos"],
    queryFn: () => listar({ data: { somenteAtivos: true, limit: 300 } }),
    enabled: !!user,
    refetchInterval: 300_000,
  });

  const hoje = hojeISO();
  const pendentes = useMemo(
    () =>
      (data ?? [])
        .filter((c) => c.proximo_contato_em && c.proximo_contato_em <= hoje)
        .sort((a, b) => (a.proximo_contato_em ?? "").localeCompare(b.proximo_contato_em ?? "")),
    [data, hoje],
  );

  useEffect(() => {
    if (pendentes.length > 0) {
      const chaveHoje = `${user?.id ?? ""}:${hoje}`;
      try {
        if (window.localStorage.getItem(DISPENSADO_KEY) === chaveHoje) return;
      } catch { /* armazenamento indisponível */ }
      setOpen(true);
      if (!tocou) {
        try {
          if (window.localStorage.getItem(SOM_KEY) !== chaveHoje) {
            toque();
            window.localStorage.setItem(SOM_KEY, chaveHoje);
          }
        } catch { toque(); }
        setTocou(true);
      }
    }
  }, [pendentes.length, tocou, user?.id, hoje]);

  const fecharHoje = () => {
    try { window.localStorage.setItem(DISPENSADO_KEY, `${user?.id ?? ""}:${hoje}`); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!user || pendentes.length === 0) return null;

  const salvar = async (c: EsteiraContrato, resultado: string) => {
    setBusy(c.id);
    try {
      const r = await registrar({ data: { contratoId: c.id, resultado: resultado as any } });
      toast.success("Contato registrado", {
        description: r.proximo
          ? `Próxima ligação em ${new Date(`${r.proximo}T12:00:00`).toLocaleDateString("pt-BR")}`
          : "Acompanhamento concluído",
      });
      await qc.invalidateQueries({ queryKey: ["esteira"] });
      window.dispatchEvent(new Event("followups-updated"));
    } catch (e: any) {
      toast.error("Não foi possível registrar", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const atrasados = pendentes.filter((c) => (c.proximo_contato_em ?? "") < hoje).length;
  const lista = pendentes.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" />
            {pendentes.length === 1
              ? "1 cliente para ligar sobre amortização"
              : `${pendentes.length} clientes para ligar sobre amortização`}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <DialogDescription>
              Registre o resultado para o aviso parar e o próximo mês ser agendado.
            </DialogDescription>
            {atrasados > 0 && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" /> {atrasados} atrasado(s)
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-2">
          {lista.map((c) => (
            <div key={c.id} className="rounded-lg border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      c.banco,
                      c.margem_usada != null ? `margem usada ${BRL.format(c.margem_usada)}` : null,
                      c.margem_restante_valor != null ? `resta ${BRL.format(c.margem_restante_valor)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Cliente da planilha de produção"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {c.telefone && (
                    <a
                      href={`tel:${c.telefone.replace(/\D/g, "")}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary"
                      title="Ligar"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {whatsappLink(c.telefone) && (
                    <a
                      href={whatsappLink(c.telefone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600"
                      title="WhatsApp"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RESULTADOS.map((r) => (
                  <Button
                    key={r.value}
                    size="sm"
                    variant={r.value === "amortizou" ? "default" : "outline"}
                    disabled={busy === c.id}
                    onClick={() => salvar(c, r.value)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {pendentes.length > lista.length && (
            <p className="text-xs text-muted-foreground">+ {pendentes.length - lista.length} outros clientes.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={fecharHoje}>
            Lembrar amanhã
          </Button>
          <Button asChild onClick={() => setOpen(false)}>
            <Link to="/prospeccao/amortizacao">Abrir minha carteira</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
