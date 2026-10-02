import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CreditCard, Upload, Trash2, Phone, MessageCircle, AlertTriangle, Flame, ArrowRight, FileText,
  SlidersHorizontal, CalendarClock, Users, Shuffle, Send, Clock, Copy,
} from "lucide-react";
import { isValidCpf } from "@/lib/cpf";
import {
  quitacaoListar, quitacaoImportar, quitacaoExcluirLote, quitacaoAdminEditar, quitacaoRegistrar, quitacaoTelefones,
  quitacaoTelefonesLote, quitacaoDistribuirPendentes, quitacaoRedistribuir, quitacaoNgAtualizar,
  type QuitacaoCliente,
} from "@/lib/prospeccao/quitacao.functions";
import { MULT_PRINCIPAL } from "@/lib/al/credito";
import { NG, NG_ETAPAS, NG_CHECKLIST, agoraMaceio, previsaoLiberacao } from "@/lib/prospeccao/ng-roteiro";

type Produto = "geral" | "ng";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number | null | undefined) => (v == null ? "—" : BRL.format(v));
const PRAZOS = ["96", "84", "72", "60", "48", "36"];
const RESULTADOS: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-sky-100 text-sky-800" },
  sem_contato: { label: "Sem contato", cls: "bg-slate-100 text-slate-700" },
  interessado: { label: "Interessado", cls: "bg-amber-100 text-amber-800" },
  proposta: { label: "Proposta enviada", cls: "bg-indigo-100 text-indigo-800" },
  fechado: { label: "Fechado", cls: "bg-emerald-100 text-emerald-800" },
  recusado: { label: "Recusado", cls: "bg-rose-100 text-rose-700" },
};

function melhorTroco(c: QuitacaoCliente) {
  let best: { prazo: string; troco: number } | null = null;
  if (c.troco_previsto != null) best = { prazo: (c.banco_previsto ?? "").match(/(\d+)x/i)?.[1] ?? "?", troco: c.troco_previsto };
  for (const p of PRAZOS) {
    const t = c.prazos?.[p]?.troco;
    if (t != null && (!best || t > best.troco)) best = { prazo: p, troco: t };
  }
  return best;
}

/** Mensagem pronta de WhatsApp para o cliente. */
function mensagem(c: QuitacaoCliente) {
  const m = melhorTroco(c);
  const primeiro = c.nome.split(" ")[0];
  return encodeURIComponent(
    `Olá, ${primeiro}! Tudo bem? Identificamos que você pode quitar seu contrato atual e ainda receber um troco estimado de ${m ? brl(m.troco) : "valor a confirmar"}${m ? ` em ${m.prazo}x` : ""}. Posso te explicar sem compromisso?`,
  );
}

const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const diaLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : null);
const retornoHoje = (c: QuitacaoCliente) => !!c.retorno_em && (diaLocal(c.retorno_em) as string) <= hojeISO();

function lerOportunidades(rows: Record<string, unknown>[]) {
  const porMat = new Map<string, any>();
  for (const r of rows) {
    const nome = String(pick(r, (k) => k === "servidor") ?? "").trim();
    const mat = String(pick(r, (k) => k === "matricula") ?? "").trim();
    if (!nome || !mat) continue;
    const cur = porMat.get(mat) ?? {
      cpf: "", nome, status: null, cod_ordem: `MAT:${mat}`.slice(0, 60), saldo: 0, parcela: 0, reserva: null, qtd_contratos: 0,
      pagas: null, abertas: null, plano: null, prazos: {}, matricula: mat, formato: "oportunidades", contratos: [],
      competencia: null, perfil: null, ritmo: null, banco_previsto: null, credito_previsto: null, troco_previsto: null,
    };
    const txt = (v: unknown) => { const t = String(v ?? "").trim(); return t || null; };
    cur.competencia ??= txt(pick(r, (k) => k === "competencia"));
    cur.perfil ??= txt(pick(r, (k) => k === "perfil"));
    cur.ritmo ??= txt(pick(r, (k) => k.startsWith("ritmo")));
    cur.banco_previsto ??= txt(pick(r, (k) => k === "banco previsto"));
    cur.credito_previsto ??= num(pick(r, (k) => k === "credito previsto"));
    cur.troco_previsto ??= num(pick(r, (k) => k === "troco previsto"));
    const parcela = num(pick(r, (k) => k === "parcela")), saldo = num(pick(r, (k) => k === "saldo"));
    cur.contratos.push({
      banco: String(pick(r, (k) => k === "banco") ?? "").slice(0, 120),
      contrato: String(pick(r, (k) => k === "contrato") ?? "").slice(0, 160),
      tipo: String(pick(r, (k) => k === "tipo") ?? "").slice(0, 40),
      parcelas: String(pick(r, (k) => k === "parcelas") ?? "").slice(0, 20),
      restantes: num(pick(r, (k) => k === "restantes")), parcela, saldo,
    });
    cur.parcela += parcela ?? 0; cur.saldo += saldo ?? 0; cur.qtd_contratos++;
    porMat.set(mat, cur);
  }
  const clientes = [...porMat.values()].map((c) => ({ ...c, parcela: Math.round(c.parcela * 100) / 100, saldo: Math.round(c.saldo * 100) / 100 }));
  return { clientes, invalidos: 0 };
}
const quaseQuitado = (c: QuitacaoCliente) => !!c.pagas && !!c.plano && c.pagas / c.plano >= 0.5;
const desatualizado = (c: QuitacaoCliente) => Date.now() - new Date(c.importado_em).getTime() > 30 * 86400_000;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, "");
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}
const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function pick(row: Record<string, unknown>, test: (k: string) => boolean) {
  const k = Object.keys(row).find((x) => test(key(x)));
  return k ? row[k] : undefined;
}

async function lerPlanilha(file: File) {
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read((await file.text()).replace(/^\uFEFF/, ""), { type: "string", FS: ";", raw: true } as any)
    : XLSX.read(await file.arrayBuffer());
  const primeira = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: !isCsv ? true : false });
  if (primeira.length && Object.keys(primeira[0]).some((k) => key(k) === "servidor") && Object.keys(primeira[0]).some((k) => key(k) === "matricula")) {
    return lerOportunidades(primeira);
  }
  const porCpf = new Map<string, any>();
  let invalidos = 0;
  for (const nomeAba of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nomeAba], { defval: null });
    for (const r of rows) {
      const cpf = String(pick(r, (k) => k === "cpf") ?? "").replace(/\D/g, "").padStart(11, "0");
      const nome = String(pick(r, (k) => k === "nome") ?? "").trim();
      if (!nome) continue;
      if (!isValidCpf(cpf)) { invalidos++; continue; }
      const cur = porCpf.get(cpf) ?? { cpf, nome, status: null, cod_ordem: "", saldo: null, parcela: null, reserva: null, qtd_contratos: null, pagas: null, abertas: null, plano: null, prazos: {} };
      const set = (f: string, v: unknown) => { if (v != null && v !== "" && cur[f] == null) cur[f] = v; };
      set("status", pick(r, (k) => k === "status") as string);
      const cod = pick(r, (k) => k.includes("ordem"));
      if (cod != null && !cur.cod_ordem) cur.cod_ordem = String(cod).trim();
      set("saldo", num(pick(r, (k) => k.includes("saldo devedor"))));
      set("parcela", num(pick(r, (k) => k.includes("valor da parcela"))));
      set("reserva", num(pick(r, (k) => k.includes("reserva"))));
      set("qtd_contratos", num(pick(r, (k) => k.includes("quantidade de contratos"))));
      set("pagas", num(pick(r, (k) => k.includes("parcelas pagas"))));
      set("abertas", num(pick(r, (k) => k.includes("em aberto"))));
      set("plano", num(pick(r, (k) => k.includes("plano do contrato"))));
      for (const k of Object.keys(r)) {
        const m = key(k).match(/(valor bruto|troco).*?(\d{2})x/);
        if (!m) continue;
        const p = (cur.prazos[m[2]] ??= { bruto: null, troco: null });
        const v = num(r[k]);
        if (m[1] === "troco") p.troco ??= v; else p.bruto ??= v;
      }
      porCpf.set(cpf, cur);
    }
  }
  const clientes = [...porCpf.values()].map((c) => ({
    ...c,
    status: c.status ? String(c.status).slice(0, 120) : null,
    qtd_contratos: c.qtd_contratos != null ? Math.round(c.qtd_contratos) : null,
    pagas: c.pagas != null ? Math.round(c.pagas) : null,
    abertas: c.abertas != null ? Math.round(c.abertas) : null,
    plano: c.plano != null ? Math.round(c.plano) : null,
  }));
  return { clientes, invalidos };
}

export function QuitacaoPage({ produto = "geral" }: { produto?: Produto }) {
  const ng = produto === "ng";
  const qc = useQueryClient();
  const listar = useServerFn(quitacaoListar);
  const telLote = useServerFn(quitacaoTelefonesLote);
  const { data, isLoading } = useQuery({ queryKey: ["quitacao", produto], queryFn: () => listar({ data: { produto } }) });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [trocoMin, setTrocoMin] = useState("");
  const [perfil, setPerfil] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [soProposta, setSoProposta] = useState(false);
  const [soRetorno, setSoRetorno] = useState(false);
  const [donoFiltro, setDonoFiltro] = useState("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [etapa, setEtapa] = useState("todos");
  const [soApto, setSoApto] = useState(true);
  const [maxRest, setMaxRest] = useState<number | null>(ng ? 6 : null);
  const [aberto, setAberto] = useState<QuitacaoCliente | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quitacao", produto] });
  const perfis = useMemo(() => [...new Set((data?.clientes ?? []).map((c) => c.perfil).filter(Boolean))] as string[], [data]);

  const lista = useMemo(() => {
    const q = key(busca);
    const qd = busca.replace(/\D/g, "");
    const min = num(trocoMin) ?? -Infinity;
    return (data?.clientes ?? [])
      .filter((c) => filtro === "todos" || c.resultado === filtro)
      .filter((c) => !ng || etapa === "todos" || c.etapa === etapa)
      .filter((c) => !ng || !soApto || c.apto_roteiro)
      .filter((c) => perfil === "todos" || c.perfil === perfil)
      .filter((c) => tipo === "todos" || (c.contratos ?? []).some((k) => k.tipo === tipo))
      .filter((c) => !soProposta || c.troco_previsto != null)
      .filter((c) => !soRetorno || retornoHoje(c))
      .filter((c) => donoFiltro === "todos" || (donoFiltro === "sem" ? !c.consultant_id : c.consultant_id === donoFiltro))
      .filter((c) => !q || key(c.nome).includes(q) || (qd.length >= 3 && (c.cpf.includes(qd) || (c.matricula ?? "").replace(/\D/g, "").includes(qd))))
      .filter((c) => (melhorTroco(c)?.troco ?? -Infinity) >= min)
      .filter((c) => { if (maxRest == null) return true; const r = restantes(c); return r != null && r <= maxRest; })
      .sort((a, b) =>
        Number(retornoHoje(b)) - Number(retornoHoje(a)) ||
        (ng ? (restantes(a) ?? 999) - (restantes(b) ?? 999) : 0) ||
        (ng ? (b.prioridade ?? 0) - (a.prioridade ?? 0) : 0) ||
        Number(quaseQuitado(b)) - Number(quaseQuitado(a)) ||
        (melhorTroco(b)?.troco ?? 0) - (melhorTroco(a)?.troco ?? 0));
  }, [data, busca, filtro, trocoMin, perfil, tipo, soProposta, soRetorno, donoFiltro, ng, etapa, soApto, maxRest]);

  const visiveis = useMemo(() => lista.slice(0, 300), [lista]);
  const chaveTel = visiveis.map((c) => c.id).join(",");
  const { data: fonesLote } = useQuery({
    queryKey: ["quitacao-tel-lote", chaveTel],
    enabled: visiveis.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => telLote({ data: { itens: visiveis.map((c) => ({ id: c.id, cpf: c.cpf, matricula: c.matricula })) } }),
  });

  const filtrosAtivos = [
    filtro !== "todos", perfil !== "todos", tipo !== "todos", soProposta, soRetorno, donoFiltro !== "todos", !!trocoMin,
  ].filter(Boolean).length;
  const retornosHoje = (data?.clientes ?? []).filter(retornoHoje).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
              <CreditCard className="h-5 w-5 shrink-0 text-primary" /> <span className="truncate">{ng ? "Quitação — Cartão de Crédito (NG)" : "Quitação — Cartão de crédito"}</span>
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{ng ? `Compra de dívida Transfer NG · ordenados por prioridade · troco estimado a ${NG.taxaPlanilha}, confirme na simulação.` : "Clientes aptos à compra de dívida, ordenados pelo maior troco. Valores vêm da planilha."}</p>
          </div>
          {retornosHoje > 0 && (
            <button type="button" onClick={() => { setSoRetorno(true); setFiltrosAbertos(true); }}
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
              <CalendarClock className="mr-1 inline h-3.5 w-3.5" />{retornosHoje} retorno(s) hoje
            </button>
          )}
        </div>

        {ng && <CorteBanner />}
        {data?.admin && <AdminPainel data={data} produto={produto} onChange={refresh} />}

        <Card className="space-y-2 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:flex md:flex-wrap">
            <Input className="min-w-0 md:max-w-xs" placeholder="Buscar nome, CPF ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button type="button" variant={filtrosAtivos ? "default" : "outline"} size="sm" className="shrink-0 md:hidden"
              onClick={() => setFiltrosAbertos((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" />{filtrosAtivos ? ` ${filtrosAtivos}` : ""}
            </Button>
            <div className={`${filtrosAbertos ? "grid" : "hidden"} col-span-2 grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center`}>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="todos">Todos os status</option>
                {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {ng && (
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                  <option value="todos">Todas as etapas</option>
                  {Object.entries(NG_ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}
              {ng && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={soApto} onChange={(e) => setSoApto(e.target.checked)} /> Só aptos (troco ≥ R$ 50)</label>}
              <Input className="h-9" placeholder="Troco mínimo (R$)" value={trocoMin} onChange={(e) => setTrocoMin(e.target.value)} />
              {!!perfis.length && (
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
                  <option value="todos">Todos os perfis</option>
                  {perfis.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="todos">Cartão e empréstimo</option>
                <option value="Cartão">Com cartão</option>
                <option value="Empréstimo">Com empréstimo</option>
              </select>
              {data?.admin && (
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={donoFiltro} onChange={(e) => setDonoFiltro(e.target.value)}>
                  <option value="todos">Todas as consultoras</option>
                  <option value="sem">Sem consultora</option>
                  {(data.consultoras ?? []).map((k) => <option key={k.id} value={k.id}>{k.email}</option>)}
                </select>
              )}
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={soProposta} onChange={(e) => setSoProposta(e.target.checked)} /> Tem proposta</label>
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={soRetorno} onChange={(e) => setSoRetorno(e.target.checked)} /> Retorno hoje</label>
              {!!filtrosAtivos && (
                <Button type="button" size="sm" variant="ghost" onClick={() => {
                  setFiltro("todos"); setPerfil("todos"); setTipo("todos"); setSoProposta(false); setSoRetorno(false); setDonoFiltro("todos"); setTrocoMin(""); setMaxRest(null); setEtapa("todos");
                }}>Limpar</Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{lista.length} cliente(s) na visão atual</p>
        </Card>

        {!isLoading && !!data?.clientes?.length && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Faltam até:</span>
            {([1, 3, 6, 12, null] as const).map((n) => {
              const qtd = (data?.clientes ?? []).filter((c) => { const r = restantes(c); return n == null || (r != null && r <= n); }).length;
              return (
                <button key={String(n)} type="button" onClick={() => setMaxRest(n)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${maxRest === n ? "border-night-green bg-night-card text-night-green" : "border-border bg-background text-foreground"}`}>
                  {n == null ? "Todos" : n === 1 ? "Quitação imediata (1)" : `${n} parcelas`} · {qtd}
                </button>
              );
            })}
          </div>
        )}
        {isLoading ? <Skeleton className="h-40 w-full" /> : !lista.length ? (
          <Card className="space-y-3 p-8 text-center text-sm text-muted-foreground">
            {data?.clientes?.length ? (
              <>
                <p>Nenhum cliente com esses filtros.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  setMaxRest(null); setFiltro("todos"); setPerfil("todos"); setTipo("todos"); setSoProposta(false); setSoRetorno(false); setDonoFiltro("todos"); setTrocoMin(""); setEtapa("todos"); setSoApto(false); setBusca("");
                }}>Mostrar todos</Button>
              </>
            ) : data?.admin ? "Nenhum cliente. Envie a planilha acima." : "Nenhum cliente de quitação atribuído a você ainda."}
          </Card>
        ) : (
          <>
            <ResumoNoturno lista={lista} />

            <div className="grid gap-3 lg:grid-cols-2">
              {visiveis.map((c) => (
                <QuitCard key={c.id} ng={ng} c={c} telefones={fonesLote?.telefones?.[c.id] ?? []} onOpen={() => setAberto(c)} />
              ))}
            </div>
          </>
        )}
        {lista.length > 300 && <p className="text-center text-xs text-muted-foreground">Mostrando 300 de {lista.length}. Use a busca ou os filtros.</p>}
      </div>
      <FichaDialog ng={ng} cliente={aberto} admin={!!data?.admin} consultoras={data?.consultoras ?? []} onClose={() => setAberto(null)} onChange={refresh} />
    </AppShell>
  );
}

function AdminPainel({ data, produto, onChange }: { data: Awaited<ReturnType<typeof quitacaoListar>>; produto: Produto; onChange: () => void }) {
  const ng = produto === "ng";
  const [modo, setModo] = useState<"quantidade" | "valor">(ng ? "valor" : "quantidade");
  const importar = useServerFn(quitacaoImportar);
  const excluir = useServerFn(quitacaoExcluirLote);
  const distribuir = useServerFn(quitacaoDistribuirPendentes);
  const redistribuir = useServerFn(quitacaoRedistribuir);
  const [previa, setPrevia] = useState<{ nome: string; clientes: any[]; invalidos: number; existentes: number; aptos: number; multi: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [dias, setDias] = useState("7");

  const porConsultora = useMemo(() => {
    const m = new Map<string, { total: number; trabalhados: number; interessados: number; fechados: number; retornos: number; troco: number }>();
    for (const c of data.clientes) {
      const k = c.consultant_id ?? "sem";
      const v = m.get(k) ?? { total: 0, trabalhados: 0, interessados: 0, fechados: 0, retornos: 0, troco: 0 };
      v.total++;
      if (c.resultado !== "novo") v.trabalhados++;
      if (c.resultado === "interessado" || c.resultado === "proposta") v.interessados++;
      if (c.resultado === "fechado") v.fechados++;
      if (retornoHoje(c)) v.retornos++;
      v.troco += Math.max(0, melhorTroco(c)?.troco ?? 0);
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "sem" ? -1 : b[0] === "sem" ? 1 : b[1].total - a[1].total));
  }, [data.clientes]);
  const email = (id: string) => (id === "sem" ? "Sem consultora" : data.consultoras.find((c) => c.id === id)?.email ?? id.slice(0, 8));
  const semDono = data.clientes.filter((c) => !c.consultant_id && c.apto_roteiro !== false).length;
  const foraRoteiro = data.clientes.filter((c) => c.apto_roteiro === false).length;
  const trocoTotal = data.clientes.filter((c) => c.apto_roteiro !== false).reduce((s, c) => s + Math.max(0, melhorTroco(c)?.troco ?? 0), 0);
  const porEtapa = Object.keys(NG_ETAPAS).map((k) => [k, data.clientes.filter((c) => (c.etapa ?? "novo") === k).length] as const);

  async function onFile(f: File) {
    try {
      const { clientes, invalidos } = await lerPlanilha(f);
      const chaves = new Set(data.clientes.map((c) => `${c.cpf}|${c.cod_ordem}`));
      setPrevia({
        nome: f.name, clientes, invalidos, existentes: clientes.filter((c) => chaves.has(`${c.cpf}|${c.cod_ordem}`)).length,
        aptos: clientes.filter((c) => (melhorTroco(c as any)?.troco ?? 0) >= NG.trocoMinimo).length,
        multi: clientes.filter((c) => (c.qtd_contratos ?? 0) > 1).length,
      });
    } catch (e) { toast.error("Não consegui ler a planilha: " + (e as Error).message); }
  }
  async function confirmar(distribuirAgora: boolean) {
    if (!previa) return;
    setEnviando(true);
    try {
      const r = await importar({ data: { nome: previa.nome, clientes: previa.clientes, distribuir: distribuirAgora, produto, modo } });
      toast.success(`${r.novos} novos e ${r.atualizados} atualizados.${r.foraRoteiro ? ` ${r.foraRoteiro} fora do roteiro (não distribuídos).` : ""}`);
      setPrevia(null); onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Card className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-primary px-3 py-2 text-sm text-primary-foreground">
          <Upload className="h-4 w-4" /> Enviar planilha
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
        <span className="text-xs text-muted-foreground">Aceita as abas "Contratos calculados" e a de prazos juntas. Reenviar a mesma planilha atualiza os valores sem duplicar.</span>
      </div>

      {ng && !!data.clientes.length && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Info l="Troco potencial (aptos)" v={brl(trocoTotal)} />
            <Info l="Clientes" v={String(data.clientes.length)} />
            <Info l="Fora do roteiro (< R$ 50)" v={String(foraRoteiro)} />
            <Info l="Sem consultora" v={String(semDono)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {porEtapa.map(([k, n]) => <span key={k} className={`rounded-full px-2 py-0.5 text-xs ${NG_ETAPAS[k].cls}`}>{NG_ETAPAS[k].label}: {n}</span>)}
          </div>
        </div>
      )}

      {previa && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="font-medium">{previa.nome}</p>
          <p>{previa.clientes.length - previa.existentes} novos · {previa.existentes} já existem (serão atualizados) · {previa.invalidos} com CPF inválido (ignorados)</p>
          {ng && <p>{previa.aptos} atendem o troco mínimo de R$ {NG.trocoMinimo} · {previa.clientes.length - previa.aptos} abaixo (importados, sem distribuir) · {previa.multi} com 2+ contratos</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={enviando} onClick={() => confirmar(true)}>Importar e distribuir igualmente</Button>
            <Button size="sm" variant="outline" disabled={enviando} onClick={() => confirmar(false)}>Importar sem distribuir</Button>
            <Button size="sm" variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-md border p-3">
        <p className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Distribuição</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Equilibrar por</span>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={modo} onChange={(e) => setModo(e.target.value as any)}>
            <option value="quantidade">Quantidade de clientes</option>
            <option value="valor">Troco total (valor)</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{semDono} cliente(s) sem consultora</span>
          <Button size="sm" disabled={ocupado || !semDono} onClick={async () => {
            setOcupado(true);
            try {
              const r = await distribuir({ data: { loteId: null, produto, modo } });
              toast.success(`${r.atribuidos} cliente(s) distribuídos entre ${r.consultoras} consultora(s).`);
              onChange();
            } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
          }}><Send className="mr-1 h-3.5 w-3.5" /> Distribuir igualmente</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sem contato há</span>
          <Input className="h-9 w-16" value={dias} onChange={(e) => setDias(e.target.value)} />
          <span className="text-muted-foreground">dias</span>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={async () => {
            const d = Number(dias);
            if (!Number.isFinite(d) || d < 0) return toast.error("Informe um número de dias válido.");
            if (!confirm(`Passar para outra consultora os clientes sem contato há ${d} dias ou mais?`)) return;
            setOcupado(true);
            try {
              const r = await redistribuir({ data: { diasSemContato: Math.round(d), deConsultora: null, produto, modo } });
              toast.success(`${r.movidos} cliente(s) passaram para outra consultora.`);
              onChange();
            } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
          }}><Shuffle className="mr-1 h-3.5 w-3.5" /> Passar para outra consultora</Button>
        </div>
      </div>

      {!!data.lotes.length && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Planilhas enviadas</p>
          {data.lotes.map((l) => (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">{l.nome} · {l.total} clientes · {new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
              <Button size="sm" variant="ghost" className="shrink-0 text-rose-700" onClick={async () => {
                if (!confirm("Excluir esta planilha e todos os clientes dela?")) return;
                await excluir({ data: { loteId: l.id } }); toast.success("Planilha excluída."); onChange();
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {!!porConsultora.length && (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Consultora</th><th>Clientes</th><th>Trabalhados</th><th>Interessados</th><th>Fechados</th><th>Retorno hoje</th><th>Troco potencial</th></tr>
            </thead>
            <tbody>{porConsultora.map(([id, v]) => (
              <tr key={id} className="border-t">
                <td className="max-w-[200px] truncate py-1">{email(id)}</td>
                <td>{v.total}</td><td>{v.trabalhados}</td><td>{v.interessados}</td><td>{v.fechados}</td>
                <td className={v.retornos ? "font-medium text-amber-700" : ""}>{v.retornos}</td>
                <td>{brl(v.troco)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FichaDialog({ ng, cliente: c, admin, consultoras, onClose, onChange }: {
  ng: boolean; cliente: QuitacaoCliente | null; admin: boolean; consultoras: { id: string; email: string }[]; onClose: () => void; onChange: () => void;
}) {
  const registrar = useServerFn(quitacaoRegistrar);
  const editar = useServerFn(quitacaoAdminEditar);
  const tel = useServerFn(quitacaoTelefones);
  const { data: fones } = useQuery({ queryKey: ["quitacao-tel", c?.id], enabled: !!c, queryFn: () => tel({ data: { cpf: c!.cpf, matricula: c!.matricula ?? undefined } }) });
  const [nota, setNota] = useState("");
  const [retorno, setRetorno] = useState("");
  useEffect(() => { setNota(""); setRetorno(c?.retorno_em ? (diaLocal(c.retorno_em) as string) : ""); }, [c?.id]);
  if (!c) return null;
  const m = melhorTroco(c);
  const msg = mensagem(c);

  async function marcar(resultado: "sem_contato" | "interessado" | "proposta" | "fechado" | "recusado") {
    try {
      await registrar({ data: { id: c!.id, resultado, nota: nota || undefined, retorno: retorno || null } });
      toast.success(retorno && resultado !== "fechado" && resultado !== "recusado" ? "Contato registrado e retorno agendado." : "Contato registrado.");
      setNota(""); onChange(); onClose();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="pr-6 text-base sm:text-lg">{c.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {c.formato === "oportunidades" ? (
            <p className="text-muted-foreground">Matrícula {c.matricula} · {c.cpf ? `CPF ${c.cpf}` : "sem CPF"} · {c.competencia ?? "—"}</p>
          ) : (
            <p className="text-muted-foreground">CPF {c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")} · Ordem {c.cod_ordem || "—"} · {c.status ?? "sem status"}</p>
          )}
          {c.retorno_em && (
            <p className="flex items-center gap-1 text-amber-700">
              <CalendarClock className="h-4 w-4" /> Retorno agendado para {new Date(c.retorno_em).toLocaleDateString("pt-BR")}
            </p>
          )}
          {desatualizado(c) && <p className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4" /> Valores importados há mais de 30 dias — reconfira antes de oferecer.</p>}
          {c.formato === "oportunidades" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Info l="Soma das parcelas" v={brl(c.parcela)} /><Info l="Saldo devedor total" v={brl(c.saldo)} />
                <Info l="Perfil" v={c.perfil ?? "—"} /><Info l="Ritmo (meses)" v={c.ritmo ?? "—"} />
              </div>
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-800">Proposta prevista</p>
                {c.troco_previsto != null || c.credito_previsto != null ? (
                  <p className="text-emerald-900">{c.banco_previsto ?? "—"} · crédito {brl(c.credito_previsto)} · <b>troco {brl(c.troco_previsto)}</b></p>
                ) : <p className="text-xs text-muted-foreground">Sem proposta na planilha.</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium">Contratos ({(c.contratos ?? []).length})</p>
                {(c.contratos ?? []).map((k, i) => (
                  <div key={i} className="rounded-md border p-2 text-xs">
                    <p className="truncate font-medium">{k.contrato || k.banco}</p>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span>Tipo: <b className="text-foreground">{k.tipo || "—"}</b></span>
                      <span>Parcelas: <b className="text-foreground">{k.parcelas || "—"}</b></span>
                      <span>Restantes: <b className="text-foreground">{k.restantes ?? "—"}</b></span>
                      <span>Parcela: <b className="text-foreground">{brl(k.parcela)}</b></span>
                      <span className="col-span-2">Saldo: <b className="text-foreground">{brl(k.saldo)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-2">
            <Info l="Saldo devedor" v={brl(c.saldo)} /><Info l="Parcela atual" v={brl(c.parcela)} />
            <Info l="Parcelas pagas" v={`${c.pagas ?? "—"} de ${c.plano ?? "—"}`} /><Info l="Em aberto" v={String(c.abertas ?? "—")} />
            <Info l="Reserva no site" v={brl(c.reserva)} /><Info l="Contratos" v={String(c.qtd_contratos ?? "—")} />
          </div>
          <p className="text-xs text-muted-foreground">{dataDados(c)}{desatualizado(c) ? " · dados com mais de 30 dias: confirme o saldo antes de oferecer" : ""}</p>
          <DuasFormas c={c} ng={ng} />
          <div className="space-y-1">
            <p className="text-xs font-medium">Troco por prazo</p>
            {PRAZOS.filter((p) => c.prazos?.[p]).map((p) => {
              const t = c.prazos[p].troco;
              return (
                <div key={p} className="grid grid-cols-3 items-center gap-2 rounded border px-2 py-1 text-xs">
                  <span className="font-medium">{p}x</span>
                  <span className="text-muted-foreground">{brl(c.prazos[p].bruto)}</span>
                  <span className={t != null && t < (ng ? NG.trocoMinimo : 0) ? "text-right text-rose-700" : "text-right font-medium text-emerald-700"}>
                    {brl(t)}{t != null && t < (ng ? NG.trocoMinimo : 0) ? (ng ? " · abaixo do mínimo" : " ·  não compensa") : ""}
                  </span>
                </div>
              );
            })}
          </div>
          </>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium">Telefones encontrados no sistema</p>
            {!fones?.telefones.length ? (
              <p className="text-xs text-muted-foreground">Nenhum. <Link to="/consulta-servidor" search={{ q: c.cpf || c.nome } as any} className="underline">Pesquisar cliente</Link></p>
            ) : fones.telefones.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="font-mono text-xs">{t}</span>
                <Button asChild size="sm" variant="outline"><a href={`tel:${t}`}><Phone className="h-3.5 w-3.5" /></a></Button>
                <Button asChild size="sm" variant="outline"><a href={`https://wa.me/55${t}?text=${msg}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a></Button>
              </div>
            ))}
          </div>
          {ng && <NgPainel c={c} nota={nota} retorno={retorno} onChange={onChange} />}
          <Input placeholder="Observação (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <label className="block space-y-1">
            <span className="text-xs font-medium">Retornar neste dia (opcional)</span>
            <Input type="date" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
            <span className="block text-[11px] text-muted-foreground">Ao marcar Interessado ou Proposta, o cliente aparece no topo da lista no dia escolhido.</span>
          </label>
          {!ng && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button size="sm" variant="outline" onClick={() => marcar("sem_contato")}>Sem contato</Button>
            <Button size="sm" variant="outline" onClick={() => marcar("interessado")}>Interessado</Button>
            <Button size="sm" variant="outline" onClick={() => marcar("proposta")}>Proposta enviada</Button>
            <Button size="sm" onClick={() => marcar("fechado")}>Fechado</Button>
            <Button size="sm" variant="ghost" className="col-span-2 text-rose-700" onClick={() => marcar("recusado")}>Recusado</Button>
          </div>}
          {c.resultado === "fechado" && <Button asChild size="sm" variant="secondary"><Link to="/prospeccao/conversoes">Registrar venda em Minha carteira</Link></Button>}
          {admin && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <select className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" defaultValue={c.consultant_id ?? ""} onChange={async (e) => {
                await editar({ data: { id: c.id, consultant_id: e.target.value || null } }); toast.success("Responsável alterado."); onChange();
              }}>
                <option value="">Sem consultora</option>
                {consultoras.map((k) => <option key={k.id} value={k.id}>{k.email}</option>)}
              </select>
              <Button size="sm" variant="ghost" className="shrink-0 text-rose-700" onClick={async () => {
                if (!confirm("Remover este cliente da quitação?")) return;
                await editar({ data: { id: c.id, remover: true } }); toast.success("Cliente removido."); onChange(); onClose();
              }}><Trash2 className="mr-1 h-4 w-4" /> Remover</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <div className="rounded border p-2"><p className="text-[11px] text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>;
}

/* ---------- Tema escuro dos cards de oportunidade ---------- */

function restantes(c: QuitacaoCliente): number | null {
  if (c.formato === "oportunidades") {
    const rs = (c.contratos ?? []).map((k) => k.restantes).filter((n): n is number => n != null);
    return rs.length ? Math.min(...rs) : null;
  }
  if (c.plano != null && c.pagas != null) return Math.max(0, c.plano - c.pagas);
  return null;
}

function Ring({ rest, total }: { rest: number | null; total: number | null }) {
  const R = 34, CIRC = 2 * Math.PI * R;
  const prog = rest != null && total ? Math.min(1, Math.max(0, (total - rest) / total)) : 0;
  return (
    <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" strokeWidth="7" className="stroke-night-line" />
        <circle cx="42" cy="42" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
          className="stroke-night-green" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - prog)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-night-green sm:text-2xl">{rest ?? "?"}</span>
        <span className="text-[8px] font-medium leading-none text-night-dim sm:text-[9px]">restantes</span>
      </div>
    </div>
  );
}

function QuitCard({ ng, c, telefones, onOpen }: { ng?: boolean; c: QuitacaoCliente; telefones: string[]; onOpen: () => void }) {
  const m = melhorTroco(c);
  const r = ng ? (NG_ETAPAS[c.etapa] ?? NG_ETAPAS.novo) : (RESULTADOS[c.resultado] ?? RESULTADOS.novo);
  const op = c.formato === "oportunidades";
  const rest = restantes(c);
  const total = op ? null : c.plano;
  const imediata = rest != null && rest <= 1;
  const principal = op ? (c.contratos ?? [])[0] : null;
  const banco = op ? (principal?.banco || principal?.contrato || "—") : (c.banco_previsto ?? (ng ? "Compra de dívida NG" : "Compra de dívida"));
  const prestes = rest != null && rest <= 6;
  const fone = telefones[0];
  const msg = mensagem(c);
  return (
    <div
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group w-full cursor-pointer space-y-3 rounded-2xl border border-night-green-deep/60 bg-night-card p-3 text-left shadow-lg transition hover:border-night-green sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-wide text-night-text sm:text-base">{c.nome}</p>
          <p className="truncate text-xs text-night-dim">
            {op ? `Matrícula ${c.matricula}${c.competencia ? ` · ${c.competencia}` : ""}` : `CPF ${c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {imediata && (
            <span className="inline-flex items-center gap-1 rounded-full bg-night-green px-2.5 py-1 text-[10px] font-bold tracking-wide text-night">
              <Flame className="h-3 w-3" /> QUITAÇÃO IMEDIATA
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.cls}`}>{r.label}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ng && c.prioridade != null && (
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.prioridade >= 60 ? "bg-night-green text-night" : c.prioridade >= 35 ? "bg-amber-400 text-night" : "bg-night text-night-dim"}`}>
            PRIORIDADE {c.prioridade >= 60 ? "ALTA" : c.prioridade >= 35 ? "MÉDIA" : "BAIXA"} · {c.prioridade}
          </span>
        )}
        {ng && (c.qtd_contratos ?? 0) > 1 && <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold text-night-text">SELECIONE TODOS OS {c.qtd_contratos} CONTRATOS</span>}
        {ng && !c.apto_roteiro && <span className="rounded-full bg-night px-2.5 py-0.5 text-[10px] font-bold text-rose-400">NÃO ATENDE O ROTEIRO</span>}
        {retornoHoje(c) && <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-night">RETORNO HOJE</span>}
        {c.perfil && <span className="rounded-full bg-night px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-night-dim">{c.perfil.toUpperCase()}</span>}
        {prestes && !imediata && <span className="rounded-full bg-night-green/20 px-2.5 py-0.5 text-[10px] font-bold text-night-green">CLIENTE PRESTES A QUITAR</span>}
        {quaseQuitado(c) && !imediata && !prestes && <span className="rounded-full bg-night px-2.5 py-0.5 text-[10px] font-semibold text-night-green">QUASE QUITADO</span>}
        {desatualizado(c) && <span className="rounded-full bg-night px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">VALORES +30 DIAS</span>}
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <Ring rest={rest} total={total} />
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold tracking-wide text-night-text">{banco}</p>
          <p className="text-xs text-night-dim">
            {op ? `${c.qtd_contratos ?? 0} contrato(s)` : `${c.pagas ?? "?"}/${c.plano ?? "?"} pagas`}
          </p>
          <p className="truncate text-xs text-night-dim">Parcela {brl(c.parcela)} · Saldo {brl(c.saldo)}</p>
          {rest != null && <p className="mt-0.5 text-xs font-semibold text-night-green">Faltam {rest} parcela(s) · quitar hoje {brl(c.saldo)}</p>}
          <p className="text-[10px] text-night-dim">{dataDados(c)}</p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-night-line pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-widest text-night-dim">{ng && c.troco_simulado != null ? `TROCO SIMULADO ${c.taxa_simulada ?? ""}` : ng ? `TROCO ESTIMADO ${NG.taxaPlanilha}` : "TROCO PREVISTO"}</p>
          {m ? (
            <>
              <p className={`text-xl font-bold sm:text-2xl ${m.troco > 0 ? "text-night-green" : "text-rose-400"}`}>{brl(ng && c.troco_simulado != null ? c.troco_simulado : m.troco)}</p>
              <p className="truncate text-xs text-night-dim">{c.banco_previsto ? `${c.banco_previsto} · ` : ""}{m.prazo}x</p>
            </>
          ) : <p className="text-sm text-night-dim">Sem proposta prevista</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {fone ? (
            <>
              <a href={`tel:${fone}`} onClick={(e) => e.stopPropagation()} aria-label="Ligar para o cliente"
                className="grid h-9 w-9 place-items-center rounded-full bg-night text-night-text transition hover:bg-night-line">
                <Phone className="h-4 w-4" />
              </a>
              <a href={`https://wa.me/55${fone}?text=${msg}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Falar no WhatsApp"
                className="grid h-9 w-9 place-items-center rounded-full bg-night-green text-night transition hover:opacity-90">
                <MessageCircle className="h-4 w-4" />
              </a>
            </>
          ) : (
            <span className="text-[10px] text-night-dim">Sem telefone</span>
          )}
          <span className="hidden items-center gap-1 text-xs font-medium text-night-dim transition group-hover:text-night-green sm:inline-flex">
            <FileText className="h-3.5 w-3.5" /> Ficha <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ResumoNoturno({ lista }: { lista: QuitacaoCliente[] }) {
  const total = lista.length;
  const imediatas = lista.filter((c) => { const r = restantes(c); return r != null && r <= 1; }).length;
  const ate6 = lista.filter((c) => { const r = restantes(c); return r != null && r <= 6; }).length;
  const ate30 = lista.filter((c) => { const r = restantes(c); return r != null && r <= 30; }).length;
  const trocoTotal = lista.reduce((s, c) => s + Math.max(0, melhorTroco(c)?.troco ?? 0), 0);
  const fechados = lista.filter((c) => c.resultado === "fechado").length;
  const retornos = lista.filter(retornoHoje).length;
  const stats: { l: string; v: string; sub?: string; destaque?: boolean }[] = [
    { l: "CLIENTES NA FILA", v: String(total), sub: `${fechados} fechados` },
    { l: "QUITAÇÃO IMEDIATA", v: String(imediatas), sub: "1 parcela ou menos", destaque: true },
    { l: "RETORNOS HOJE", v: String(retornos), sub: `${ate6} com até 6 parcelas` },
    { l: "TROCO PREVISTO TOTAL", v: brl(trocoTotal), sub: `${ate30} com até 30 parcelas` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.l} className={`rounded-2xl border p-3 sm:p-4 ${s.destaque ? "border-night-green-deep/60 bg-night-card" : "border-night-line bg-night-card"}`}>
          <p className="text-[10px] font-semibold tracking-widest text-night-dim">{s.l}</p>
          <p className={`mt-1 text-xl font-bold sm:text-2xl ${s.destaque ? "text-night-green" : "text-night-text"}`}>{s.v}</p>
          {s.sub && <p className="mt-0.5 text-xs text-night-dim">{s.sub}</p>}
          {s.destaque && total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-night">
              <div className="h-full rounded-full bg-night-green" style={{ width: `${Math.round((imediatas / total) * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Transfer NG ---------- */

function CorteBanner() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 30_000); return () => clearInterval(i); }, []);
  const { h, m, dow } = agoraMaceio(t);
  const min = h * 60 + m;
  const fim = dow === 0 || dow === 6;
  const falta = (hr: number) => { const d = hr * 60 - min; return `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`; };
  const prev = previsaoLiberacao(t).toLocaleString("pt-BR", { timeZone: "America/Maceio", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const cls = fim || min >= NG.corteFinanceiro * 60 ? "border-rose-300 bg-rose-50 text-rose-900" : min >= NG.corteMesa * 60 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-900";
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-xs sm:text-sm ${cls}`}>
      <span className="flex items-center gap-1 font-semibold"><Clock className="h-4 w-4" />
        {fim ? "Fim de semana: propostas entram no próximo dia útil"
          : min < NG.corteMesa * 60 ? `Mesa fecha às 14h (faltam ${falta(NG.corteMesa)})`
          : min < NG.corteFinanceiro * 60 ? `Mesa fechada · Financeiro fecha às 15h (faltam ${falta(NG.corteFinanceiro)})`
          : "Após as 15h: proposta entra no próximo dia útil"}
      </span>
      <span>Enviando agora, liberação prevista: <b>{prev}</b> (48h)</span>
    </div>
  );
}

function Copiar({ v }: { v: string }) {
  return (
    <button type="button" className="ml-1 inline-flex items-center rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Copiar ${v}`}
      onClick={() => { navigator.clipboard?.writeText(v); toast.success("Copiado."); }}>
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function NgPainel({ c, nota, retorno, onChange }: { c: QuitacaoCliente; nota: string; retorno: string; onChange: () => void }) {
  const atualizar = useServerFn(quitacaoNgAtualizar);
  const [check, setCheck] = useState<Record<string, boolean>>(c.checklist ?? {});
  const [troco, setTroco] = useState(c.troco_simulado != null ? String(c.troco_simulado) : "");
  const [taxa, setTaxa] = useState(c.taxa_simulada ?? "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setCheck(c.checklist ?? {}); setTroco(c.troco_simulado != null ? String(c.troco_simulado) : ""); setTaxa(c.taxa_simulada ?? ""); }, [c.id]);
  const feitos = NG_CHECKLIST.filter((i) => check[i.k]).length;

  async function salvar(etapa?: string) {
    const t = num(troco);
    if (etapa === "digitada" && feitos < NG_CHECKLIST.length && !confirm("O checklist do roteiro não está completo. Marcar como digitada mesmo assim?")) return;
    if (t != null && t < NG.trocoMinimo && etapa === "digitada") toast.warning(`Troco simulado abaixo do mínimo de R$ ${NG.trocoMinimo}.`);
    setSalvando(true);
    try {
      const r = await atualizar({ data: {
        id: c.id, etapa: etapa as any, checklist: check, troco_simulado: t, taxa_simulada: taxa || null,
        nota: nota || undefined, retorno: retorno || null,
      } });
      toast.success(etapa ? `Etapa: ${NG_ETAPAS[etapa].label}.${r.liberacao_prevista && (etapa === "digitada" || etapa === "validacao") ? ` Liberação prevista ${new Date(r.liberacao_prevista).toLocaleString("pt-BR", { timeZone: "America/Maceio" })}.` : ""}` : "Salvo.");
      onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">Roteiro Transfer NG · digitar proposta</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${(NG_ETAPAS[c.etapa] ?? NG_ETAPAS.novo).cls}`}>{(NG_ETAPAS[c.etapa] ?? NG_ETAPAS.novo).label}</span>
      </div>
      {(c.qtd_contratos ?? 0) > 1 && (
        <p className="flex items-center gap-1 rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
          <AlertTriangle className="h-4 w-4" /> Cliente tem {c.qtd_contratos} contratos: selecione TODOS na consulta pela lupa.
        </p>
      )}
      {!c.apto_roteiro && <p className="text-xs text-rose-700">Troco estimado abaixo de R$ {NG.trocoMinimo}: não atende o roteiro.</p>}
      <div className="grid gap-1 text-xs">
        <p>Empregador: <b>{NG.empregador}</b><Copiar v={NG.empregador.split(" - ")[0]} /></p>
        <p>Produto: <b>{NG.produto}</b> · Tipo: <b>{NG.tipoProposta}</b></p>
        <p>Histórico: <b>{NG.historico}</b> · Banco: <b>{NG.banco}</b><Copiar v="999" /></p>
        <p>CPF: <b>{c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</b><Copiar v={c.cpf} /> · Ordem <b>{c.cod_ordem || "—"}</b>{c.cod_ordem && <Copiar v={c.cod_ordem} />}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {NG.tabelas.map((t) => (
            <button key={t.codigo} type="button" onClick={() => setTaxa(t.taxa)}
              className={`rounded border px-2 py-0.5 ${taxa === t.taxa ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
              {t.codigo} · {t.taxa}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">Checklist ({feitos}/{NG_CHECKLIST.length})</p>
        {NG_CHECKLIST.map((i) => (
          <label key={i.k} className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={!!check[i.k]} onChange={(e) => setCheck((s) => ({ ...s, [i.k]: e.target.checked }))} />
            <span>{i.l}</span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs font-medium">Valor líquido que saiu na simulação (R$)</label>
        <Input placeholder="Ex.: 12.500,00" value={troco} onChange={(e) => setTroco(e.target.value)} />
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => salvar()}>Salvar simulação</Button>
      </div>
      {c.liberacao_prevista && <p className="text-xs text-emerald-800">Liberação prevista: {new Date(c.liberacao_prevista).toLocaleString("pt-BR", { timeZone: "America/Maceio" })}</p>}
      <div className="space-y-1">
        <label className="text-xs font-medium">Andamento da proposta</label>
        <select disabled={salvando} value={c.etapa ?? "novo"} onChange={(e) => salvar(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(NG_ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function dataDados(c: QuitacaoCliente) {
  const d = c.importado_em ? new Date(c.importado_em).toLocaleDateString("pt-BR") : null;
  if (c.competencia) return `Dados de ${c.competencia}${d ? ` · importado em ${d}` : ""}`;
  return d ? `Dados de ${d} (importação)` : "";
}

function DuasFormas({ c, ng }: { c: QuitacaoCliente; ng: boolean }) {
  const m = melhorTroco(c);
  const livre = c.parcela ?? null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1 rounded-lg border p-3 text-xs">
        <p className="text-sm font-semibold">Cliente quita com dinheiro próprio</p>
        <p>Valor para quitar: <b>{brl(c.saldo)}</b></p>
        <p>Margem que fica livre: <b>{brl(livre)}</b> por mês</p>
        {livre != null && <p className="text-muted-foreground">Com essa margem poderia pegar aprox. {brl(livre * MULT_PRINCIPAL.min)} a {brl(livre * MULT_PRINCIPAL.max)} (estimativa).</p>}
      </div>
      <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
        <p className="text-sm font-semibold">Empresa quita e refaz a margem</p>
        <p>Troco estimado: <b>{m ? `${brl(m.troco)} em ${m.prazo}x` : "—"}</b>{ng ? ` (taxa da planilha ${NG.taxaPlanilha})` : ""}</p>
        <p className="font-semibold">Solicitar validação da gerência antes da operação — serviço à parte.</p>
      </div>
    </div>
  );
}
