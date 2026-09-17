import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shuffle,
  RefreshCw,
  Eraser,
  Scale,
  TrendingUp,
  UserX,
  RotateCcw,
  Eye,
  Settings2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  adminDistributeLeads,
  adminPreviewDistribution,
  adminRecycleLeads,
  adminRandomRedistribute,
  adminResetAllAccess,
  adminLiberarLeadsDeAdmins,
} from "@/lib/prospeccao/prospeccao.functions";
import { adminRedistributeTrabalhados } from "@/lib/prospeccao/trabalhados.functions";
import {
  redistribuirPromovidosIgualmente,
  redistribuirPromovidosPorDesempenho,
  getResumoCarteiras,
  reiniciarPromovidosTodos,
} from "@/lib/radar/promovidos-recentes.functions";
import {
  revogarAcessosInativosTomadoresAl,
  distribuirTomadoresAl,
} from "@/lib/prospeccao/tomadores-al.functions";

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

type PreviaLinha = { consultantId: string; email: string; atual: number; recebe: number; final: number };

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
  const previewDistribution = useServerFn(adminPreviewDistribution);
  const recycleLeads = useServerFn(adminRecycleLeads);
  const randomRedistribute = useServerFn(adminRandomRedistribute);
  const resetAll = useServerFn(adminResetAllAccess);
  const liberarDeAdmins = useServerFn(adminLiberarLeadsDeAdmins);
  const redistribuirRadar = useServerFn(redistribuirPromovidosIgualmente);
  const fetchResumo = useServerFn(getResumoCarteiras);
  const reiniciarTodosPromovidos = useServerFn(reiniciarPromovidosTodos);
  const redistribuirDesempenho = useServerFn(redistribuirPromovidosPorDesempenho);
  const revogarInativos = useServerFn(revogarAcessosInativosTomadoresAl);
  const redistribuirTrabalhados = useServerFn(adminRedistributeTrabalhados);
  const distribuirTomadores = useServerFn(distribuirTomadoresAl);

  const [base, setBase] = useState<"crm" | "radar" | "tomadores">("crm");
  const [distMode, setDistMode] = useState<"round_robin" | "score" | "city">("round_robin");
  const [embaralharTudo, setEmbaralharTudo] = useState(false);
  const [previa, setPrevia] = useState<{
    disponiveis: number;
    disponiveisNovos: number;
    disponiveisTrabalhados: number;
    linhas: PreviaLinha[];
  } | null>(null);
  const [incluirTrabalhados, setIncluirTrabalhados] = useState(false);
  const [alvoTomadores, setAlvoTomadores] = useState(10);
  const [recycleMode, setRecycleMode] = useState<"round_robin" | "score">("score");
  const [idleDays, setIdleDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [includeOutras, setIncludeOutras] = useState(true);
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [incluirAbordados, setIncluirAbordados] = useState(false);
  const [diasBloqueioReinicio, setDiasBloqueioReinicio] = useState(7);
  const [diasDesempenho, setDiasDesempenho] = useState(14);
  const [pesoMax, setPesoMax] = useState(4);
  const [statusSel, setStatusSel] = useState<Set<string>>(new Set(["novo"]));
  const [somenteNaoContatados, setSomenteNaoContatados] = useState(true);
  const [diasTrabalhados, setDiasTrabalhados] = useState(4);

  const resumo = useQuery({
    queryKey: ["radar", "resumo-carteiras"],
    queryFn: () => fetchResumo(),
    staleTime: 30_000,
  });

  const toggleStatus = (key: string) =>
    setStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ---------- 1. Entregar clientes ----------

  const verPrevia = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const p = await previewDistribution({
        data: { consultantIds: [...selected], mode: distMode, incluirTrabalhados },
      });
      setPrevia(p);
      if (p.disponiveis === 0) {
        toast.info(
          incluirTrabalhados
            ? "Nenhum cliente disponível no estoque."
            : `Nenhum cliente novo no estoque. Há ${p.disponiveisTrabalhados} já trabalhado(s) — marque a opção abaixo para entregá-los.`,
        );
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao calcular a prévia."); }
    setBusy(false);
  };

  const runDistribuirCrm = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      if (embaralharTudo) {
        const d = await randomRedistribute({ data: { consultantIds: [...selected], includeOutrasAbas: includeOutras } });
        const extra = includeOutras ? ` · promovidos: ${d.promovidos} · tomadores: ${d.tomadores}` : "";
        if (!d.assigned && !d.promovidos && !d.tomadores) toast.info("Nenhum cliente disponível para dividir.");
        else toast.success(`${d.assigned} cliente(s) redivididos entre ${selected.size} consultora(s)${extra}.`);
      } else {
        const d = await distributeLeads({
          data: { consultantIds: [...selected], mode: distMode, incluirTrabalhados },
        });
        if (d.assigned === 0)
          toast.info(
            incluirTrabalhados
              ? "Nenhum cliente disponível no estoque."
              : "Nenhum cliente novo no estoque. Marque \"incluir clientes já trabalhados\" para reaproveitar a base.",
          );
        else
          toast.success(
            `${d.assigned} cliente(s) divididos igualmente entre ${Object.keys(d.perConsultant).length} consultora(s).` +
              (d.reiniciados ? ` ${d.reiniciados} já trabalhado(s) voltaram para "ainda não falei".` : ""),
          );
      }
      setPrevia(null);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao entregar os clientes."); }
    setBusy(false);
  };

  const runDistribuirRadar = async () => {
    setBusy(true);
    try {
      const d = await redistribuirRadar({ data: { janelaDias: null, incluirAbordados } });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa com conta no sistema.");
      else if (d.atribuidos === 0) toast.info("Os clientes já estão divididos igualmente.");
      else toast.success(`${d.atribuidos} cliente(s) do Radar divididos igualmente entre ${d.consultoras} consultora(s).`);
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["promovidos-recentes"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao dividir."); }
    setBusy(false);
  };

  const runDistribuirTomadores = async () => {
    setBusy(true);
    try {
      const d = await distribuirTomadores({ data: { alvoPorFaixa: alvoTomadores } });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa cadastrada.");
      else if (d.atribuidos === 0) toast.info("As carteiras já estão completas — nada novo para entregar.");
      else {
        const detalhe = Object.entries(d.porConsultora)
          .filter(([, n]) => n > 0)
          .map(([nome, n]) => `${nome}: ${n}`)
          .join(" · ");
        toast.success(
          `${d.atribuidos} cliente(s) entregues igualmente a ${d.consultoras} consultora(s).` +
            (detalhe ? ` ${detalhe}.` : "") +
            (d.estoqueCurto ? " Atenção: o estoque acabou antes de completar as carteiras." : ""),
        );
      }
      qc.invalidateQueries({ queryKey: ["tomadores-al"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao entregar os tomadores."); }
    setBusy(false);
  };

  const runEntregar = () => {
    if (base === "crm") return runDistribuirCrm();
    if (base === "radar") return runDistribuirRadar();
    return runDistribuirTomadores();
  };

  const descricaoEntrega =
    base === "crm"
      ? embaralharTudo
        ? `Todos os clientes em aberto serão embaralhados e divididos igualmente entre ${selected.size} consultora(s). Retornos e anotações seguem com o cliente.`
        : `${unassignedCount} cliente(s) sem responsável serão divididos de forma que todas as ${selected.size} consultora(s) fiquem com filas do mesmo tamanho.`
      : base === "radar"
        ? "Os clientes do Radar (Diário Oficial) serão divididos em partes iguais entre todas as consultoras ativas com conta no sistema."
        : "Os clientes da base Tomadores com Margem – AL serão entregues em rodízio, um por vez, para todas ficarem com a mesma quantidade.";

  // ---------- outras ações ----------

  const runRecycle = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await recycleLeads({ data: { consultantIds: [...selected], idleDays, mode: recycleMode } });
      if (d.recycled === 0) toast.info(`Nenhum cliente parado há ${idleDays}+ dia(s) para reciclar.`);
      else toast.success(`${d.recycled} cliente(s) reciclado(s) para ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao reciclar."); }
    setBusy(false);
  };

  const runRedistribuirTrabalhados = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await redistribuirTrabalhados({ data: { consultantIds: [...selected], dias: diasTrabalhados } });
      if (d.redistribuidos === 0) toast.info(`Nenhum cliente já trabalhado parado há ${diasTrabalhados}+ dia(s) com a mesma consultora.`);
      else toast.success(`${d.redistribuidos} cliente(s) voltaram ao rodízio entre ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao redistribuir."); }
    setBusy(false);
  };

  const runReiniciarPromovidos = async () => {
    setBusy(true);
    try {
      const d = await reiniciarTodosPromovidos({ data: { diasBloqueio: diasBloqueioReinicio, janelaDias: null } });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa com conta no sistema.");
      else
        toast.success(
          `${d.reiniciados} promovido(s) reiniciado(s) e ${d.atribuidos} entregue(s) a ${d.consultoras} consultora(s).` +
            (d.semDono > 0 ? ` ${d.semDono} ficaram no estoque para evitar repetição.` : ""),
        );
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["promovidos-recentes"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao reiniciar os promovidos."); }
    setBusy(false);
  };

  const runRedistribuirPorDesempenho = async () => {
    if (statusSel.size === 0) { toast.error("Selecione ao menos uma situação para redistribuir."); return; }
    setBusy(true);
    try {
      const d = await redistribuirDesempenho({
        data: { diasDesempenho, janelaDias: null, pesoMax, status: [...statusSel], somenteNaoContatados },
      });
      if (d.consultoras === 0) toast.error("Nenhuma consultora ativa com conta no sistema.");
      else if (d.atribuidos === 0) toast.info("Nenhum cliente disponível para redistribuir.");
      else
        toast.success(
          `${d.atribuidos} cliente(s) distribuídos por desempenho entre ${d.consultoras} consultora(s)` +
            (d.topConsultora ? ` · destaque: ${d.topConsultora}` : "") + ".",
        );
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["promovidos-recentes"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao distribuir por desempenho."); }
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
          `${d.acessosRevogados} acesso(s) revogado(s) · ${d.leadsReciclados} cliente(s) reciclado(s) · ${d.distribuidos} entregue(s) entre ${d.consultorasAtivas} consultora(s) ativa(s).`,
        );
      }
      resumo.refetch();
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao revogar acessos inativos."); }
    setBusy(false);
  };

  const runReset = async () => {
    setBusy(true);
    try {
      await resetAll({ data: { revokeAccess } });
      toast.success("Vínculos limpos. Retornos e anotações foram preservados.");
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao limpar."); }
    setBusy(false);
  };

  return (
    <Card className="p-4 md:p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Shuffle className="h-4 w-4" /> Entregar e reciclar clientes
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Cada cliente fica com apenas uma consultora. A entrega é sempre igual: quem tem a fila menor
        recebe primeiro.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
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
              className={`min-h-9 max-w-full truncate rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/50"}`}
            >
              {c.email}
            </button>
          );
        })}
        {!consultants.length && <span className="text-xs text-muted-foreground">Nenhuma consultora encontrada.</span>}
      </div>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        {/* 1. Entregar clientes */}
        <div className="min-w-0 rounded-lg border p-4 md:col-span-2">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4" /> 1. Entregar clientes em partes iguais
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Escolha a base e o sistema divide para todas ficarem com a mesma quantidade.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Base de clientes</Label>
              <Select value={base} onValueChange={(v) => { setBase(v as typeof base); setPrevia(null); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm">CRM da prospecção</SelectItem>
                  <SelectItem value="radar">Recém-promovidos (Diário Oficial)</SelectItem>
                  <SelectItem value="tomadores">Tomadores com Margem – AL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {base === "crm" && (
              <div>
                <Label className="text-xs">Como agrupar</Label>
                <Select value={distMode} onValueChange={(v) => { setDistMode(v as typeof distMode); setPrevia(null); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Rodízio simples (mais equilibrado)</SelectItem>
                    <SelectItem value="score">Espalhando os mais quentes</SelectItem>
                    <SelectItem value="city">Mesma cidade para a mesma pessoa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {base === "crm" && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {unassignedCount} cliente(s) sem responsável no momento.
              </p>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={incluirTrabalhados}
                  onCheckedChange={(v) => { setIncluirTrabalhados(v === true); setPrevia(null); }}
                />
                Incluir clientes já trabalhados (eles voltam para "ainda não falei" e reaparecem na
                fila, sem perder o histórico de contatos)
              </label>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={embaralharTudo} onCheckedChange={(v) => { setEmbaralharTudo(v === true); setPrevia(null); }} />
                Embaralhar tudo, inclusive os clientes que já estão com alguém
              </label>
              {embaralharTudo && (
                <label className="flex items-start gap-2 pl-6 text-xs">
                  <Checkbox checked={includeOutras} onCheckedChange={(v) => setIncludeOutras(v === true)} />
                  Incluir também Recém-promovidos e Tomadores – AL
                </label>
              )}
              {!embaralharTudo && (
                <Button variant="outline" size="sm" onClick={verPrevia} disabled={busy}>
                  <Eye className="mr-2 h-4 w-4" /> Ver prévia por consultora
                </Button>
              )}
              {previa && !embaralharTudo && (
                <p className="text-xs text-muted-foreground">
                  No estoque: {previa.disponiveisNovos} cliente(s) novo(s) e{" "}
                  {previa.disponiveisTrabalhados} já trabalhado(s). Vão ser entregues{" "}
                  {previa.disponiveis}.
                </p>
              )}
              {previa && !embaralharTudo && (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 font-medium">Consultora</th>
                        <th className="px-2 py-1.5 font-medium">Fila hoje</th>
                        <th className="px-2 py-1.5 font-medium">Recebe</th>
                        <th className="px-2 py-1.5 font-medium">Fica com</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.linhas.map((l) => (
                        <tr key={l.consultantId} className="border-t">
                          <td className="max-w-[110px] truncate px-2 py-1.5 sm:max-w-[220px]">{l.email}</td>
                          <td className="px-2 py-1.5">{l.atual}</td>
                          <td className="px-2 py-1.5 font-medium">+{l.recebe}</td>
                          <td className="px-2 py-1.5">{l.final}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {base === "radar" && (
            <label className="mt-3 flex items-start gap-2 text-xs">
              <Checkbox checked={incluirAbordados} onCheckedChange={(v) => setIncluirAbordados(v === true)} />
              Incluir também quem já foi abordado (por padrão, quem já trabalhou o cliente permanece com ele)
            </label>
          )}

          {base === "tomadores" && (
            <div className="mt-3 space-y-2">
              <Label className="text-xs">Clientes em aberto por faixa de margem</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={alvoTomadores}
                onChange={(e) => setAlvoTomadores(Math.max(1, Math.min(200, Number(e.target.value) || 10)))}
                className="h-9 w-24"
              />
              <p className="text-xs text-muted-foreground">
                Cada consultora ativa fica com essa quantidade em aberto em cada faixa (alta, média e
                baixa). Se o estoque acabar, a diferença entre as carteiras não passa de um cliente.
              </p>
            </div>
          )}

          <ConfirmDialog
            title="Entregar clientes agora?"
            description={descricaoEntrega}
            confirmLabel="Entregar"
            onConfirm={runEntregar}
          >
            <Button className="mt-3 w-full" disabled={busy}>
              <Scale className="mr-2 h-4 w-4" /> Entregar agora
            </Button>
          </ConfirmDialog>
        </div>

        {/* 2. Reciclar parados */}
        <div className="min-w-0 rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">2. Reciclar clientes parados</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Tira de quem não trabalhou e passa para quem está com a fila menor.
          </p>
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
                  <SelectItem value="score">Mais quentes primeiro</SelectItem>
                  <SelectItem value="round_robin">Rodízio simples</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ConfirmDialog
            title="Reciclar clientes parados?"
            description={`Clientes sem tratativa há ${idleDays}+ dia(s) saem das consultoras atuais e são redivididos entre as ${selected.size} selecionadas.`}
            confirmLabel="Reciclar"
            destructive
            onConfirm={runRecycle}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reciclar agora
            </Button>
          </ConfirmDialog>
        </div>

        {/* 3. Já trabalhados voltam ao rodízio */}
        <div className="min-w-0 rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">3. Devolver ao rodízio quem já foi trabalhado</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Clientes com interesse ou proposta que estão com a mesma consultora há {diasTrabalhados}{" "}
            dia(s) voltam para o rodízio. O histórico segue com o cliente.
          </p>
          <Label className="text-xs">Dias com a mesma consultora</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={diasTrabalhados}
            onChange={(e) => setDiasTrabalhados(Math.max(1, Math.min(30, Number(e.target.value) || 4)))}
            className="mt-1 h-9 w-24"
          />
          <ConfirmDialog
            title="Devolver ao rodízio?"
            description={`Clientes com interesse ou proposta que estão com a mesma consultora há ${diasTrabalhados} dia(s) ou mais voltam ao rodízio entre as ${selected.size} consultora(s) selecionada(s).`}
            confirmLabel="Devolver ao rodízio"
            onConfirm={runRedistribuirTrabalhados}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Devolver ao rodízio
            </Button>
          </ConfirmDialog>
        </div>

        {/* 4. Reiniciar promovidos */}
        <div className="min-w-0 rounded-lg border p-4 md:col-span-2">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <RotateCcw className="h-4 w-4" /> 4. Reiniciar os recém-promovidos (1 clique)
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Zera a situação de todos os promovidos e reparte de novo, em partes iguais. O mesmo
            cliente não volta para quem já o atendeu nos últimos {diasBloqueioReinicio} dia(s).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Bloqueio de repetição (dias)</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={diasBloqueioReinicio}
                onChange={(e) => setDiasBloqueioReinicio(Math.max(0, Math.min(90, Number(e.target.value) || 7)))}
                className="mt-1 h-9 w-24"
              />
            </div>
            <ConfirmDialog
              title="Reiniciar e repartir todos os promovidos?"
              description={`Todos os promovidos voltam para a situação inicial, o histórico é guardado e a entrega é refeita em partes iguais — sem repetir quem atendeu o cliente nos últimos ${diasBloqueioReinicio} dia(s).`}
              confirmLabel="Reiniciar e repartir"
              requireText="REINICIAR"
              onConfirm={runReiniciarPromovidos}
            >
              <Button disabled={busy}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar todos agora
              </Button>
            </ConfirmDialog>
          </div>
        </div>

        {/* Opções avançadas */}
        <details className="min-w-0 rounded-lg border p-4 md:col-span-2">
          <summary className="cursor-pointer text-sm font-medium">
            <span className="inline-flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Opções avançadas (entrega por desempenho)
            </span>
          </summary>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="mb-1 flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" /> Entrega por desempenho
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Atenção: esta opção <strong>não</strong> divide em partes iguais — quem produz mais
              recebe mais. O desempenho é medido nos últimos {diasDesempenho} dias.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Janela de desempenho (dias)</Label>
                <Input
                  type="number" min={1} max={180} value={diasDesempenho}
                  onChange={(e) => setDiasDesempenho(Math.max(1, Number(e.target.value) || 14))}
                  className="mt-1 h-9 w-24"
                />
              </div>
              <div>
                <Label className="text-xs">Vantagem do topo (x)</Label>
                <Input
                  type="number" min={1} max={10} step={0.5} value={pesoMax}
                  onChange={(e) => setPesoMax(Math.min(10, Math.max(1, Number(e.target.value) || 4)))}
                  className="mt-1 h-9 w-24"
                />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs">Quais promovidos redistribuir</Label>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                {STATUS_REDIST.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={statusSel.has(s.key)} onCheckedChange={() => toggleStatus(s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
              <label className="mt-2 flex items-start gap-2 text-xs">
                <Checkbox checked={somenteNaoContatados} onCheckedChange={(v) => setSomenteNaoContatados(v === true)} />
                Apenas quem nunca foi contatado
              </label>
            </div>

            <ConfirmDialog
              title="Distribuir por desempenho?"
              description={`Serão redistribuídos apenas os promovidos com a situação: ${
                statusSel.size ? [...statusSel].map((k) => STATUS_LABEL[k] ?? k).join(", ") : "nenhuma"
              }. Quem produz mais recebe mais clientes.`}
              confirmLabel="Distribuir por desempenho"
              onConfirm={runRedistribuirPorDesempenho}
            >
              <Button className="mt-3 w-full" variant="secondary" disabled={busy}>
                <TrendingUp className="mr-2 h-4 w-4" /> Distribuir por desempenho
              </Button>
            </ConfirmDialog>
          </div>
        </details>

        {/* Quadro de carteiras */}
        <div className="min-w-0 rounded-lg border p-4 md:col-span-2">
          <p className="mb-2 text-sm font-medium">Carteira de cada consultora</p>
          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full min-w-[420px] text-xs">
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

        {/* Zona de risco */}
        <div className="min-w-0 rounded-lg border border-destructive/40 p-4 md:col-span-2">
          <p className="mb-3 text-sm font-semibold text-destructive">Ações delicadas</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-sm font-medium">Encerrar acesso de quem não entra há 10 dias</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Bloqueia o login (reversível, a conta não é excluída), devolve ao estoque os clientes
                de Tomadores – AL parados com ela e reparte na hora entre quem continua ativa.
              </p>
              <ConfirmDialog
                title="Encerrar acessos parados há 10+ dias?"
                description="Consultoras sem login há 10 dias ou mais perdem o acesso (bloqueio reversível) e os clientes em aberto delas voltam ao estoque e são repartidos entre quem está ativa."
                confirmLabel="Encerrar e reciclar"
                destructive
                requireText="REVOGAR"
                onConfirm={runRevogarInativos}
              >
                <Button className="w-full" variant="destructive" disabled={busy}>
                  <UserX className="mr-2 h-4 w-4" /> Encerrar acessos parados
                </Button>
              </ConfirmDialog>
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-sm font-medium">Limpar todos os vínculos</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Devolve todos os clientes ao estoque (prospecção, promovidos e tomadores). Retornos e
                anotações não são apagados.
              </p>
              <label className="flex items-start gap-2 text-xs">
                <Checkbox checked={revokeAccess} onCheckedChange={(v) => setRevokeAccess(v === true)} />
                Também remover permissões de abas e papéis (administradores mantidos)
              </label>
              <ConfirmDialog
                title="Limpar todos os vínculos?"
                description="Todos os clientes voltam ao estoque sem responsável. Retornos e anotações são preservados. Esta ação não pode ser desfeita."
                confirmLabel="Limpar tudo"
                destructive
                requireText="LIMPAR"
                onConfirm={runReset}
              >
                <Button className="mt-3 w-full" variant="destructive" disabled={busy}>
                  <Eraser className="mr-2 h-4 w-4" /> Limpar agora
                </Button>
              </ConfirmDialog>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
