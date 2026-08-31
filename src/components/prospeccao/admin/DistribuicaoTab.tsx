import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shuffle, RefreshCw, Dices, Eraser, Scale, TrendingUp, UserX } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  adminDistributeLeads,
  adminRecycleLeads,
  adminRandomRedistribute,
  adminResetAllAccess,
} from "@/lib/prospeccao/prospeccao.functions";
import { adminRedistributeTrabalhados } from "@/lib/prospeccao/trabalhados.functions";
import {
  redistribuirPromovidosIgualmente,
  redistribuirPromovidosPorDesempenho,
  getResumoCarteiras,
} from "@/lib/radar/promovidos-recentes.functions";
import { revogarAcessosInativosTomadoresAl } from "@/lib/prospeccao/tomadores-al.functions";
import { previewSplit } from "@/lib/prospeccao/admin-import";

type Consultant = { id: string; email: string };

const STATUS_REDIST: { key: string; label: string }[] = [
  { key: "novo", label: "Pendente / não abordado" },
  { key: "contatado", label: "Contatado" },
  { key: "proposta_enviada", label: "Proposta enviada" },
  { key: "sem_interesse", label: "Sem interesse" },
  { key: "erro", label: "Erro" },
  { key: "convertido", label: "Convertido" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_REDIST.map((s) => [s.key, s.label]),
);

export function DistribuicaoTab({
  consultants, selected, onToggle, onSelectAll, onClear, unassignedCount,
}: {
  consultants: Consultant[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  unassignedCount: number;
}) {
  const qc = useQueryClient();
  const distributeLeads = useServerFn(adminDistributeLeads);
  const recycleLeads = useServerFn(adminRecycleLeads);
  const [distMode, setDistMode] = useState<"round_robin" | "score" | "city">("round_robin");
  const [recycleMode, setRecycleMode] = useState<"round_robin" | "score">("score");
  const [idleDays, setIdleDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const randomRedistribute = useServerFn(adminRandomRedistribute);
  const resetAll = useServerFn(adminResetAllAccess);
  const [includeOutras, setIncludeOutras] = useState(true);
  const [revokeAccess, setRevokeAccess] = useState(true);
  const redistribuirRadar = useServerFn(redistribuirPromovidosIgualmente);
  const fetchResumo = useServerFn(getResumoCarteiras);
  const [incluirAbordados, setIncluirAbordados] = useState(false);
  const redistribuirDesempenho = useServerFn(redistribuirPromovidosPorDesempenho);
  const [diasDesempenho, setDiasDesempenho] = useState(14);
  const [pesoMax, setPesoMax] = useState(4);
  const [statusSel, setStatusSel] = useState<Set<string>>(new Set(["novo"]));
  const [somenteNaoContatados, setSomenteNaoContatados] = useState(true);
  const revogarInativos = useServerFn(revogarAcessosInativosTomadoresAl);
  const redistribuirTrabalhados = useServerFn(adminRedistributeTrabalhados);
  const [diasTrabalhados, setDiasTrabalhados] = useState(4);

  const toggleStatus = (key: string) =>
    setStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const runRedistribuirTrabalhados = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await redistribuirTrabalhados({ data: { consultantIds: [...selected], dias: diasTrabalhados } });
      if (d.redistribuidos === 0) toast.info(`Nenhum lead qualificado parado há ${diasTrabalhados}+ dia(s) com a mesma consultora.`);
      else toast.success(`${d.redistribuidos} lead(s) trabalhado(s) voltaram ao rodízio entre ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao redistribuir trabalhados."); }
    setBusy(false);
  };

  const runRedistribuirPorDesempenho = async () => {
    if (statusSel.size === 0) {
      toast.error("Selecione ao menos um status para redistribuir.");
      return;
    }
    setBusy(true);
    try {
      const d = await redistribuirDesempenho({
        data: {
          diasDesempenho,
          janelaDias: null,
          pesoMax,
          status: [...statusSel],
          somenteNaoContatados,
        },
      });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa com conta no sistema.");
      else if (d.atribuidos === 0) toast.info("Nenhum lead disponível para redistribuir.");
      else
        toast.success(
          `${d.atribuidos} lead(s) distribuídos por desempenho entre ${d.consultoras} consultora(s)` +
            (d.topConsultora ? ` · destaque: ${d.topConsultora}` : "") + ".",
        );
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["promovidos-recentes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao distribuir por desempenho.");
    }
    setBusy(false);
  };

  const resumo = useQuery({
    queryKey: ["radar", "resumo-carteiras"],
    queryFn: () => fetchResumo(),
    staleTime: 30_000,
  });

  const split = previewSplit(unassignedCount, selected.size);

  const runRedistribuirRadar = async () => {
    setBusy(true);
    try {
      const d = await redistribuirRadar({ data: { janelaDias: null, incluirAbordados } });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa com conta no sistema.");
      else if (d.atribuidos === 0) toast.info("Os leads já estão distribuídos igualmente.");
      else toast.success(`${d.atribuidos} lead(s) do Radar divididos igualmente entre ${d.consultoras} consultora(s).`);
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["promovidos-recentes"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao redistribuir."); }
    setBusy(false);
  };

  const runRandom = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await randomRedistribute({ data: { consultantIds: [...selected], includeOutrasAbas: includeOutras } });
      const extra = includeOutras ? ` · promovidos: ${d.promovidos} · tomadores: ${d.tomadores}` : "";
      if (!d.assigned && !d.promovidos && !d.tomadores) toast.info("Nenhum lead disponível para sortear.");
      else toast.success(`${d.assigned} lead(s) sorteado(s) entre ${selected.size} consultora(s)${extra}.`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no sorteio."); }
    setBusy(false);
  };

  const runReset = async () => {
    setBusy(true);
    try {
      await resetAll({ data: { revokeAccess } });
      toast.success("Vínculos limpos. Follow-ups e anotações foram preservados.");
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao limpar."); }
    setBusy(false);
  };

  const runDistribute = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await distributeLeads({ data: { consultantIds: [...selected], mode: distMode } });
      if (d.assigned === 0) toast.info("Nenhum lead não atribuído para distribuir.");
      else toast.success(`${d.assigned} lead(s) distribuído(s) entre ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao distribuir."); }
    setBusy(false);
  };

  const runRecycle = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await recycleLeads({ data: { consultantIds: [...selected], idleDays, mode: recycleMode } });
      if (d.recycled === 0) toast.info(`Nenhum lead parado há ${idleDays}+ dia(s) para reciclar.`);
      else toast.success(`${d.recycled} lead(s) reciclado(s) para ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao reciclar."); }
    setBusy(false);
  };

  const runRevogarInativos = async () => {
    setBusy(true);
    try {
      const d = await revogarInativos();
      if (d.acessosRevogados === 0 && d.leadsReciclados === 0) {
        toast.info("Nenhum acesso parado há 10+ dias encontrado.");
      } else {
        toast.success(
          `${d.acessosRevogados} acesso(s) revogado(s) · ${d.leadsReciclados} lead(s) reciclado(s) · ${d.distribuidos} distribuído(s) entre ${d.consultorasAtivas} consultora(s) ativa(s).`,
        );
      }
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar acessos inativos.");
    }
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Shuffle className="h-4 w-4" /> Distribuir &amp; reciclar leads</p>
      <p className="mb-4 text-xs text-muted-foreground">Cada lead vai para apenas uma consultora. Marque quem deve participar do rodízio.</p>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Consultoras participantes ({selected.size}/{consultants.length})</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>Todas</Button>
          <Button variant="ghost" size="sm" onClick={onClear}>Nenhuma</Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {consultants.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/50"}`}
            >
              {c.email}
            </button>
          );
        })}
        {!consultants.length && <span className="text-xs text-muted-foreground">Nenhuma consultora encontrada.</span>}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Distribuir leads não atribuídos</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {unassignedCount} lead(s) no pool → {selected.size} consultora(s) · ~{split.each} cada{split.rest ? ` (+1 para ${split.rest})` : ""}.
          </p>
          <Label className="text-xs">Critério</Label>
          <Select value={distMode} onValueChange={(v) => setDistMode(v as typeof distMode)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">Round-robin (rodízio igual)</SelectItem>
              <SelectItem value="score">Por score (espalha os quentes)</SelectItem>
              <SelectItem value="city">Por cidade (mesma cidade, mesma pessoa)</SelectItem>
            </SelectContent>
          </Select>
          <ConfirmDialog
            title="Distribuir leads agora?"
            description={`${unassignedCount} lead(s) sem responsável serão divididos entre ${selected.size} consultora(s) — aproximadamente ${split.each} para cada.`}
            confirmLabel="Distribuir"
            onConfirm={runDistribute}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}><Shuffle className="mr-2 h-4 w-4" /> Distribuir agora</Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Reciclar leads parados</p>
          <p className="mb-2 text-xs text-muted-foreground">Tira leads sem tratativa de quem não trabalhou e passa para quem tem menos fila.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Parados há (dias)</Label>
              <Input type="number" min={1} max={60} value={idleDays} onChange={(e) => setIdleDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Select value={recycleMode} onValueChange={(v) => setRecycleMode(v as typeof recycleMode)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Por score</SelectItem>
                  <SelectItem value="round_robin">Round-robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ConfirmDialog
            title="Reciclar leads parados?"
            description={`Leads sem tratativa há ${idleDays}+ dia(s) serão retirados das consultoras atuais e redistribuídos entre as ${selected.size} selecionadas.`}
            confirmLabel="Reciclar"
            destructive
            onConfirm={runRecycle}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}><RefreshCw className="mr-2 h-4 w-4" /> Reciclar agora</Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Sorteio aleatório geral</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Embaralha todos os leads em aberto (do pool e já atribuídos) e divide entre as consultoras
            marcadas. Follow-ups e anotações salvos vão junto para o novo responsável.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={includeOutras} onCheckedChange={(v) => setIncludeOutras(v === true)} />
            Incluir Promovidos (Diário Oficial) e Tomadores com Margem – AL
          </label>
          <ConfirmDialog
            title="Sortear leads aleatoriamente?"
            description={`Todos os leads em aberto serão embaralhados e divididos entre ${selected.size} consultora(s). Follow-ups e anotações seguem com o lead.`}
            confirmLabel="Sortear"
            onConfirm={runRandom}
          >
            <Button className="mt-3 w-full" disabled={busy}><Dices className="mr-2 h-4 w-4" /> Sortear agora</Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Redistribuir leads trabalhados</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Mesmo que a consultora já tenha trabalhado e qualificado o lead, ele volta ao rodízio
            depois de {diasTrabalhados} dia(s) para a base continuar circulando entre quem está
            selecionado. Follow-ups e anotações seguem com o lead e o novo responsável ganha uma
            janela limpa de {diasTrabalhados} dia(s).
          </p>
          <Label className="text-xs">Dias com a mesma consultora</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={diasTrabalhados}
            onChange={(e) => setDiasTrabalhados(Math.max(1, Math.min(30, Number(e.target.value) || 4)))}
            className="mt-1 h-8 w-24"
          />
          <ConfirmDialog
            title="Redistribuir leads trabalhados?"
            description={`Leads com status qualificado ou proposta que estão com a mesma consultora há ${diasTrabalhados} dia(s) ou mais voltarão para o rodízio e serão divididos entre as ${selected.size} consultora(s) selecionada(s).`}
            confirmLabel="Redistribuir"
            onConfirm={runRedistribuirTrabalhados}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Redistribuir trabalhados
            </Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border p-4 md:col-span-2">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4" /> Radar Diário Oficial — entrega igualitária
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Divide os promovidos encontrados pelo Radar em partes iguais entre todas as consultoras
            ativas com conta no sistema, começando pelos mais recentes (janela de ouro).
          </p>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={incluirAbordados} onCheckedChange={(v) => setIncluirAbordados(v === true)} />
            Incluir também os leads já abordados (por padrão, quem já trabalhou o lead permanece com ele)
          </label>
          <ConfirmDialog
            title="Redistribuir igualmente os promovidos?"
            description="Os leads do Radar serão divididos em partes iguais entre todas as consultoras ativas com conta no sistema."
            confirmLabel="Redistribuir"
            onConfirm={runRedistribuirRadar}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}>
              <Scale className="mr-2 h-4 w-4" /> Redistribuir igualmente agora
            </Button>
          </ConfirmDialog>

          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="mb-1 flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" /> Entrega por desempenho (meritocracia)
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Quem produz mais recebe mais leads e quem produz menos recebe menos. O desempenho é
              medido nos últimos {diasDesempenho} dias (leads abordados no Radar + pontos da
              competição). Leads já trabalhados permanecem com quem os abordou.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Janela de desempenho (dias)</Label>
                <Input
                  type="number" min={1} max={180} value={diasDesempenho}
                  onChange={(e) => setDiasDesempenho(Math.max(1, Number(e.target.value) || 14))}
                  className="mt-1 h-8 w-24"
                />
              </div>
              <div>
                <Label className="text-xs">Vantagem do topo (x)</Label>
                <Input
                  type="number" min={1} max={10} step={0.5} value={pesoMax}
                  onChange={(e) => setPesoMax(Math.min(10, Math.max(1, Number(e.target.value) || 4)))}
                  className="mt-1 h-8 w-24"
                />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs">Quais promovidos redistribuir</Label>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                {STATUS_REDIST.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={statusSel.has(s.key)}
                      onCheckedChange={() => toggleStatus(s.key)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <Checkbox
                  checked={somenteNaoContatados}
                  onCheckedChange={(v) => setSomenteNaoContatados(v === true)}
                />
                Apenas leads que nunca foram contatados (desmarque para incluir os que já tiveram contato registrado)
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Selecionados: {statusSel.size ? [...statusSel].map((k) => STATUS_LABEL[k] ?? k).join(", ") : "nenhum"}
              </p>
            </div>

            <ConfirmDialog
              title="Distribuir por desempenho?"
              description={`Serão redistribuídos apenas os promovidos com status: ${
                statusSel.size ? [...statusSel].map((k) => STATUS_LABEL[k] ?? k).join(", ") : "nenhum"
              }. Quem produz mais recebe mais leads; quem produz menos recebe menos.`}
              confirmLabel="Distribuir por desempenho"
              onConfirm={runRedistribuirPorDesempenho}
            >
              <Button className="mt-3 w-full" disabled={busy}>
                <TrendingUp className="mr-2 h-4 w-4" /> Distribuir por desempenho agora
              </Button>
            </ConfirmDialog>
          </div>

          <div className="mt-4 max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-medium">Consultora</th>
                  <th className="px-2 py-1.5 font-medium">Últimos 15 dias</th>
                  <th className="px-2 py-1.5 font-medium">Total</th>
                  <th className="px-2 py-1.5 font-medium">Última entrega</th>
                </tr>
              </thead>
              <tbody>
                {(resumo.data ?? []).filter((c) => c.ativo || c.total > 0).map((c) => (
                  <tr key={c.nome} className="border-t">
                    <td className="px-2 py-1.5">
                      {c.nome}
                      {!c.ativo && <span className="ml-1 text-muted-foreground">(inativa)</span>}
                    </td>
                    <td className="px-2 py-1.5">{c.janela}</td>
                    <td className="px-2 py-1.5">{c.total}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {c.ultimaEntrega ? new Date(c.ultimaEntrega).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
                {!resumo.isLoading && (resumo.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Sem consultoras cadastradas.</td></tr>
                )}
                {resumo.isLoading && (
                  <tr><td colSpan={4} className="px-2 py-3 text-center text-muted-foreground">Carregando…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">Revogar acessos inativos (Tomadores AL)</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Bloqueia o login de consultoras sem acesso há 10 dias ou mais (bloqueio reversível, a
            conta não é excluída), devolve ao estoque os leads de Tomadores com Margem – AL que
            ficaram parados com elas e distribui na hora entre as consultoras que continuam ativas.
          </p>
          <ConfirmDialog
            title="Revogar acessos parados há 10+ dias?"
            description="Consultoras sem login há 10 dias ou mais perdem o acesso (bloqueio reversível), ficam inativas na distribuição e os leads em aberto que estavam com elas voltam para o estoque e são redistribuídos agora entre quem está ativo."
            confirmLabel="Revogar e reciclar"
            destructive
            onConfirm={runRevogarInativos}
          >
            <Button className="mt-3 w-full" variant="destructive" disabled={busy}>
              <UserX className="mr-2 h-4 w-4" /> Revogar acessos parados e reciclar
            </Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">Limpar vínculos e acessos</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Devolve todos os leads ao pool (prospecção, promovidos e tomadores AL). Follow-ups e
            anotações não são apagados — ficam guardados para a próxima distribuição.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={revokeAccess} onCheckedChange={(v) => setRevokeAccess(v === true)} />
            Também revogar permissões de abas e papéis (administradores mantidos)
          </label>
          <ConfirmDialog
            title="Limpar todos os vínculos?"
            description="Todos os leads voltam ao pool sem responsável. Follow-ups e anotações são preservados. Esta ação não pode ser desfeita."
            confirmLabel="Limpar tudo"
            destructive
            onConfirm={runReset}
          >
            <Button className="mt-3 w-full" variant="destructive" disabled={busy}><Eraser className="mr-2 h-4 w-4" /> Limpar agora</Button>
          </ConfirmDialog>
        </div>
      </div>
    </Card>
  );
}
