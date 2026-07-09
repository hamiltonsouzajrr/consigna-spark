// Rota PÚBLICA de acesso individual da consultora (sem login).
// Acesso via link com token único: /consultora/{token}. Mostra a fila de leads
// (do_registros) atribuídos à consultora pela distribuição automática que ainda
// não foram abordados nem revisados — até 10 por vez; ao mudar o status de um,
// o próximo pendente aparece automaticamente.
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getConsultoraPortal,
  setConsultoraLeadStatus,
  type ConsultoraLead,
} from "@/lib/radar/consultora-portal.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radar, Loader2, Phone, Check, Copy, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/consultora/$token")({
  head: () => ({
    meta: [
      { title: "Meus leads — Consultora" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConsultoraPortalPage,
});

const ABORDAGEM_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "contatado", label: "Abordado / contatado" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "convertido", label: "Convertido" },
  { value: "sem_interesse", label: "Sem interesse" },
];



const MAX_VISIVEIS = 10;

function fmtBR(d: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function ConsultoraPortalPage() {
  const { token } = useParams({ from: "/consultora/$token" });
  const fetchPortal = useServerFn(getConsultoraPortal);
  const setStatus = useServerFn(setConsultoraLeadStatus);

  const isValid = typeof token === "string" && token.length >= 8;
  const portal = useQuery({
    queryKey: ["consultora-portal", token],
    queryFn: () => fetchPortal({ data: { token } }),
    enabled: isValid,
    refetchOnWindowFocus: false,
  });

  // IDs já resolvidos localmente (removidos da fila) para trazer o próximo lead
  // sem esperar o refetch da rede.
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());

  const fila = useMemo(() => {
    const all = portal.data?.leads ?? [];
    return all.filter((l) => !resolvidos.has(l.id));
  }, [portal.data, resolvidos]);

  const visiveis = fila.slice(0, MAX_VISIVEIS);
  const restantes = Math.max(0, fila.length - visiveis.length);

  async function mudarStatus(
    lead: ConsultoraLead,
    patch: { status_abordagem?: string; status_revisao?: string },
  ) {
    try {
      await setStatus({ data: { token, id: lead.id, ...(patch as any) } });
      // Se saiu da fila de pendentes (abordado ou revisado), remove localmente
      // para o próximo lead aparecer automaticamente.
      const saiuDaFila =
        (patch.status_abordagem && patch.status_abordagem !== "novo") ||
        (patch.status_revisao && patch.status_revisao !== "Novo");
      if (saiuDaFila) {
        setResolvidos((prev) => new Set(prev).add(lead.id));
      }
      toast.success("Status atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar o status.");
    }
  }

  if (!isValid) return <InvalidLink />;

  if (portal.isLoading) {
    return (
      <Center>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Center>
    );
  }

  if (portal.isError || !portal.data?.ok) return <InvalidLink />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radar className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight md:text-xl">
              Olá, {portal.data.nome}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sua fila de leads de servidores promovidos — abordagem prioritária.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {fila.length === 0
              ? "Nenhum lead pendente no momento."
              : `${fila.length} lead${fila.length === 1 ? "" : "s"} pendente${fila.length === 1 ? "" : "s"}`}
            {restantes > 0 && ` · mostrando ${visiveis.length}`}
          </p>
        </div>

        {visiveis.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            🎉 Você está em dia! Nenhum lead pendente para abordar agora.
          </Card>
        ) : (
          visiveis.map((lead) => <LeadCard key={lead.id} lead={lead} onStatus={mudarStatus} />)
        )}

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Estas informações vêm de publicações oficiais. Use os dados com finalidade
            legítima, respeitando a LGPD e boas práticas de tratamento de dados.
          </p>
        </div>
      </main>
    </div>
  );
}

function LeadCard({
  lead,
  onStatus,
}: {
  lead: ConsultoraLead;
  onStatus: (
    lead: ConsultoraLead,
    patch: { status_abordagem?: string; status_revisao?: string },
  ) => void;
}) {
  const nome = lead.nome_completo || lead.nome_servidor;
  const orgao = lead.orgao_lotacao || lead.orgao;
  const cargoAtual = lead.cargo_atual || lead.cargo;
  const cargoPromovido =
    lead.cargo_promovido ||
    join(lead.cargo_anterior, lead.cargo_novo) ||
    join(lead.classe_anterior, lead.classe_nova) ||
    join(lead.nivel_anterior, lead.nivel_novo);
  const dataProm = fmtBR(lead.data_promocao) || fmtBR(lead.data_publicacao);

  const copiarNome = async () => {
    try {
      await navigator.clipboard.writeText(nome);
      toast.success("Nome copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{nome}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lead.cpf_parcial && <span className="font-semibold text-primary">CPF: {lead.cpf_parcial}</span>}
            {lead.cpf_parcial && lead.matricula && "   ·   "}
            {lead.matricula && <span>Matrícula: {lead.matricula}</span>}
          </p>
        </div>
        {dataProm && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">🎉 {dataProm}</Badge>}
      </div>

      <div className="mt-2 grid gap-1.5 text-sm md:grid-cols-2">
        <div>🏛️ <span className="text-muted-foreground">Órgão:</span> <strong>{orgao || "—"}</strong></div>
        <div>💼 <span className="text-muted-foreground">Cargo atual:</span> <strong>{cargoAtual || "—"}</strong></div>
        <div>⬆️ <span className="text-muted-foreground">Promovido:</span> <strong>{cargoPromovido || "—"}</strong></div>
        <div>📅 <span className="text-muted-foreground">Data da promoção:</span> <strong>{dataProm || "—"}</strong></div>
      </div>

      {/* Roteiro de abordagem (mesmo dos registros) */}
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-900/40 dark:bg-blue-950/20">
        <h4 className="mb-2 text-sm font-semibold">📋 Roteiro de Abordagem</h4>
        <div className="space-y-2">
          <div>
            <p className="font-semibold">PASSO 1 — Localizar no Nova Vida</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-muted-foreground">
              → Buscar pelo nome: <strong className="text-foreground">{nome}</strong>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copiarNome}>
                <Copy className="h-3 w-3" />
              </Button>
            </p>
          </div>
          <div>
            <p className="font-semibold">PASSO 2 — Verificar margem disponível</p>
            <p className="mt-0.5 text-muted-foreground">
              → Confirmar aumento de margem pela promoção de{" "}
              <strong className="text-foreground">{dataProm || "—"}</strong>
            </p>
          </div>
          <div>
            <p className="font-semibold">PASSO 3 — Abordar o servidor</p>
            <p className="mt-0.5 text-muted-foreground">
              → Parabenizar: "Vi que você foi promovido(a) em {dataProm || "—"}" e apresentar a
              oferta de crédito consignado com a nova margem.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => onStatus(lead, { status_abordagem: "contatado" })}
        >
          <Phone className="mr-1 h-4 w-4" /> ABORDAR
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStatus(lead, { status_revisao: "Revisado" })}>
          <Check className="mr-1 h-4 w-4" /> REVISADO
        </Button>
        <Select value="novo" onValueChange={(v) => onStatus(lead, { status_abordagem: v })}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Mudar status…" />
          </SelectTrigger>
          <SelectContent>
            {ABORDAGEM_OPTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}

function join(a: string | null, b: string | null): string {
  if (!a && !b) return "";
  return `${a || "—"} → ${b || "—"}`;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}

function InvalidLink() {
  return (
    <Center>
      <Card className="max-w-sm p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifique o endereço de acesso com o administrador.
        </p>
      </Card>
    </Center>
  );
}
