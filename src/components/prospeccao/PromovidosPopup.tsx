// Pop-up de prioridade: avisa a consultora quando há servidores recém promovidos
// na carteira dela ainda sem abordagem — janela de ouro de 48h (alta conversão).
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PartyPopper, Flame } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getPromovidosRecentes, type PromovidoRecente } from "@/lib/radar/promovidos-recentes.functions";

const KEY = "promovidos-popup-visto";

function jaVistoHoje(): boolean {
  try {
    return window.localStorage.getItem(KEY) === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

export function PromovidosPopup() {
  const { user } = useAuth();
  const fetchLeads = useServerFn(getPromovidosRecentes);
  const [rows, setRows] = useState<PromovidoRecente[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || jaVistoHoje()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchLeads({ data: { offset: 0, limit: 3, apenasNovos: true } });
        if (cancelled || !res.vinculada || res.total === 0) return;
        setRows(res.rows);
        setTotal(res.total);
        setOpen(true);
      } catch {
        /* silencioso: o pop-up é auxiliar */
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const fechar = () => {
    try { window.localStorage.setItem(KEY, new Date().toISOString().slice(0, 10)); } catch { /* ignore */ }
    setOpen(false);
  };

  if (rows.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : fechar())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            {total === 1 ? "1 promovido recente na sua carteira" : `${total} promovidos recentes na sua carteira`}
          </DialogTitle>
          <DialogDescription>
            Quem acabou de ser promovido tem margem nova e alta chance de conversão. Fale nas primeiras 48h.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border p-2">
              <p className="text-sm font-medium leading-tight">{r.nome_servidor}</p>
              <p className="text-xs text-muted-foreground">
                {r.orgao ?? "Órgão não informado"} · {r.cargo_novo ?? r.cargo ?? "cargo não informado"}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {String(r.potencial_financeiro ?? "").toLowerCase() === "alto" && (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Flame className="mr-1 h-3 w-3" /> Alto potencial
                  </Badge>
                )}
                {!r.cpf_confirmado && <Badge variant="outline">Validar CPF no Congonhas</Badge>}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={fechar}>Depois</Button>
          <Button asChild onClick={fechar}>
            <Link to="/prospeccao/promovidos-recentes">Ver todos e abordar</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
