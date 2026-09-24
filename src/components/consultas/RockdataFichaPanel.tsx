import { Copy, Mail, MapPin, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelefonesRanking } from "@/components/consultas/TelefonesRanking";
import type { ConsultaResultado } from "@/lib/consultas/rockdata.functions";

function copiar(valor: string) {
  navigator.clipboard?.writeText(valor);
  toast.success("Copiado");
}

export function RockdataFichaPanel({ resultado, atualizar }: { resultado: ConsultaResultado; atualizar: () => void }) {
  const ficha = resultado.ficha;
  if (!ficha) return null;
  const telefones = ficha.telefonesDetalhe?.length
    ? ficha.telefonesDetalhe
    : ficha.telefones.map((numero) => ({
        numero, tipo: null, whatsapp: false, restricao: false, qualificacao: 0,
        score: 0, nivel: "duvidoso" as const, sinais: [],
      }));
  const enderecos = ficha.enderecosDetalhe?.length
    ? ficha.enderecosDetalhe
    : ficha.enderecos.map((completo) => ({ completo, logradouro: completo, numero: null, complemento: null, bairro: null, cidade: null, uf: null, cep: null }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="font-semibold">{ficha.pessoa.nome ?? "Cliente"}</span>
          <Badge variant="secondary">{resultado.origem === "banco" ? "Salvo no sistema" : "Consulta nova"}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={atualizar} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar RockData
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <TelefonesRanking cpf={resultado.cpf} telefones={telefones} />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Endereços ({enderecos.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {enderecos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum endereço disponível.</p>}
            {enderecos.map((e, i) => (
              <div key={`${e.completo}-${i}`} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{[e.logradouro, e.numero].filter(Boolean).join(", ") || e.completo}</p>
                  <Button size="icon" variant="ghost" title="Copiar endereço" onClick={() => copiar(e.completo)}><Copy className="h-4 w-4" /></Button>
                </div>
                {(e.complemento || e.bairro) && <p className="text-xs text-muted-foreground">{[e.complemento, e.bairro].filter(Boolean).join(" · ")}</p>}
                {(e.cidade || e.uf || e.cep) && <p className="text-xs text-muted-foreground">{[e.cidade, e.uf].filter(Boolean).join("/")} {e.cep ? `· CEP ${e.cep}` : ""}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados cadastrais</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ficha.pessoa.campos.map((c, i) => <div key={`${c.label}-${i}`} className="border-b pb-2"><p className="text-xs text-muted-foreground">{c.label}</p><p className="text-sm font-medium">{c.valor}</p></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" /> E-mails ({ficha.emails.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ficha.emails.length === 0 && <p className="text-sm text-muted-foreground">Nenhum e-mail disponível.</p>}
            {ficha.emails.map((email) => <div key={email} className="flex items-center justify-between gap-2 border-b pb-2 text-sm"><span className="break-all">{email}</span><Button size="icon" variant="ghost" title="Copiar e-mail" onClick={() => copiar(email)}><Copy className="h-4 w-4" /></Button></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}