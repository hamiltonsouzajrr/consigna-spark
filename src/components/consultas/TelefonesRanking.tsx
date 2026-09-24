import { useServerFn } from "@tanstack/react-start";
import { Copy, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { registrarContatoConsulta } from "@/lib/consultas/rockdata.functions";
import { NIVEL_ROTULO } from "@/lib/consultas/telefone-score";
import type { NivelTelefone, RockdataTelefone } from "@/lib/consultas/rockdata.server";

const NIVEL_CLASSE: Record<NivelTelefone, string> = {
  confiavel: "bg-success/15 text-success border-success/30",
  bom: "bg-primary/15 text-primary border-primary/30",
  duvidoso: "bg-warning/15 text-warning border-warning/30",
  invalido: "bg-destructive/15 text-destructive border-destructive/30",
  desconhecido: "bg-muted text-muted-foreground border-border",
};

const soDigitos = (v: string) => v.replace(/\D/g, "");

export function TelefonesRanking({ cpf, telefones }: { cpf: string | null; telefones: RockdataTelefone[] }) {
  const registrar = useServerFn(registrarContatoConsulta);
  const contar = (numero: string, kind: "ligacao" | "whatsapp") => {
    if (!cpf) return;
    registrar({ data: { cpf, telefone: soDigitos(numero), kind } })
      .then((r) => {
        if (r.pontos > 0) toast.success(`Contato registrado na prospecção (+${r.pontos} pts)`);
        else toast.info(r.motivo ?? "Contato registrado na prospecção");
      })
      .catch(() => toast.error("Não foi possível registrar o contato."));
  };
  const copiar = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast.success("Copiado");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Phone className="h-4 w-4" /> Telefones ({telefones.length})
          <span className="text-xs font-normal text-muted-foreground">do mais confiável para o menos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {telefones.length === 0 && <p className="text-sm text-muted-foreground">Nenhum telefone disponível.</p>}
        {telefones.map((t, i) => (
          <div
            key={t.numero}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 ${
              t.nivel === "invalido" ? "opacity-60" : ""
            } ${i === 0 && t.nivel === "confiavel" ? "border-success/50 bg-success/5" : ""}`}
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.numero}</span>
                <Badge variant="outline" className={NIVEL_CLASSE[t.nivel]}>
                  {NIVEL_ROTULO[t.nivel]}
                </Badge>
                {t.tipo && <Badge variant="secondary">{t.tipo === "celular" ? "Celular" : "Fixo"}</Badge>}
                {t.whatsapp && <Badge variant="secondary">WhatsApp</Badge>}
                {t.restricao && <Badge variant="destructive">Restrição</Badge>}
                {t.nivel !== "desconhecido" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${Math.round(t.score / 20)} de 5 estrelas de confiança`}>
                    {[1, 2, 3, 4, 5].map((estrela) => (
                      <Star key={estrela} className={`h-3.5 w-3.5 ${estrela <= Math.round(t.score / 20) ? "fill-warning text-warning" : "text-muted-foreground/35"}`} />
                    ))}
                    <span>{Math.round(t.score / 20)}/5</span>
                  </span>
                )}
              </div>
              {t.sinais.length > 0 && <p className="text-xs text-muted-foreground">{t.sinais.join(" · ")}</p>}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={i === 0 ? "default" : "outline"} asChild>
                <a href={`tel:+55${soDigitos(t.numero)}`} onClick={() => contar(t.numero, "ligacao")}>
                  Ligar
                </a>
              </Button>
              <Button size="sm" variant="outline" className="gap-1" asChild>
                <a
                  href={`https://wa.me/55${soDigitos(t.numero)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => contar(t.numero, "whatsapp")}
                >
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => copiar(t.numero)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
