// Pop-up de lembrete de follow-up: aparece em tela para a consultora quando há
// retornos agendados vencidos (ou vencendo nos próximos minutos). Reaparece a
// cada 3 minutos e pode ser adiado por 15 minutos.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { whatsappLink } from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const SNOOZE_KEY = "followup-popup-snooze";
const SNOOZE_MIN = 15;
const JANELA_MIN = 10; // avisa também os que vencem nos próximos 10 minutos

type Lead = { id: string; nome: string; telefone: string | null; next_follow_up_at: string };

function snoozedUntil(): number {
  try { return Number(window.localStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; }
}

export function FollowupPopup() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      if (Date.now() < snoozedUntil()) return;
      const limite = new Date(Date.now() + JANELA_MIN * 60_000).toISOString();
      const { data } = await supabase
        .from("prospect_leads")
        .select("id,nome,telefone,next_follow_up_at")
        .eq("consultant_id", user.id)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", limite)
        .not("status", "in", "(ganho,perdido)")
        .order("next_follow_up_at", { ascending: true })
        .limit(20);
      if (cancelled) return;
      const rows = (data ?? []) as Lead[];
      setLeads(rows);
      if (rows.length > 0) setOpen(true);
    };

    load();
    const id = setInterval(load, 3 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  const proximos = useMemo(() => leads.slice(0, 5), [leads]);
  if (!user || leads.length === 0) return null;

  const snooze = () => {
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MIN * 60_000)); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : snooze())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-orange-500" />
            {leads.length === 1 ? "Você tem 1 follow-up agora" : `Você tem ${leads.length} follow-ups agora`}
          </DialogTitle>
          <DialogDescription>Retorne o contato para não perder a venda.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {proximos.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.next_follow_up_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              {l.telefone && (
                <a
                  href={`tel:${l.telefone.replace(/\D/g, "")}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary"
                  title="Ligar"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
              {whatsappLink(l.telefone) && (
                <a
                  href={whatsappLink(l.telefone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  title="WhatsApp"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
          {leads.length > proximos.length && (
            <p className="text-xs text-muted-foreground">+ {leads.length - proximos.length} outros agendamentos.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={snooze}>Lembrar em {SNOOZE_MIN} min</Button>
          <Button asChild onClick={() => setOpen(false)}>
            <Link to="/prospeccao/followups">Abrir Follow-ups</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
