import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Upload, Trash2, Phone, MessageCircle, AlertTriangle } from "lucide-react";
import { isValidCpf } from "@/lib/cpf";
import {
  quitacaoListar, quitacaoImportar, quitacaoExcluirLote, quitacaoAdminEditar, quitacaoRegistrar, quitacaoTelefones,
  type QuitacaoCliente,
} from "@/lib/prospeccao/quitacao.functions";

export const Route = createFileRoute("/_authenticated/quitacao")({
  head: () => ({
    meta: [
      { title: "Quitação — Cartão de crédito | Prospecção de compra de dívida" },
      { name: "description", content: "Clientes aptos à quitação/compra de dívida com troco estimado por prazo para prospecção." },
      { property: "og:title", content: "Quitação — Cartão de crédito" },
      { property: "og:description", content: "Clientes aptos à compra de dívida com troco estimado por prazo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuitacaoPage,
});

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
  for (const p of PRAZOS) {
    const t = c.prazos?.[p]?.troco;
    if (t != null && (!best || t > best.troco)) best = { prazo: p, troco: t };
  }
  return best;
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
  const wb = XLSX.read(await file.arrayBuffer());
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

function QuitacaoPage() {
  const qc = useQueryClient();
  const listar = useServerFn(quitacaoListar);
  const { data, isLoading } = useQuery({ queryKey: ["quitacao"], queryFn: () => listar() });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [trocoMin, setTrocoMin] = useState("");
  const [aberto, setAberto] = useState<QuitacaoCliente | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["quitacao"] });

  const lista = useMemo(() => {
    const q = key(busca);
    const qd = busca.replace(/\D/g, "");
    const min = num(trocoMin) ?? -Infinity;
    return (data?.clientes ?? [])
      .filter((c) => filtro === "todos" || c.resultado === filtro)
      .filter((c) => !q || key(c.nome).includes(q) || (qd.length >= 3 && c.cpf.includes(qd)))
      .filter((c) => (melhorTroco(c)?.troco ?? -Infinity) >= min)
      .sort((a, b) => Number(quaseQuitado(b)) - Number(quaseQuitado(a)) || (melhorTroco(b)?.troco ?? 0) - (melhorTroco(a)?.troco ?? 0));
  }, [data, busca, filtro, trocoMin]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><CreditCard className="h-5 w-5 text-primary" /> Quitação — Cartão de crédito</h1>
          <p className="text-sm text-muted-foreground">Clientes aptos à compra de dívida, ordenados pelo maior troco. Valores vêm da planilha e não são recalculados.</p>
        </div>

        {data?.admin && <AdminPainel data={data} onChange={refresh} />}

        <Card className="flex flex-wrap items-center gap-2 p-3">
          <Input className="max-w-xs" placeholder="Buscar nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Input className="w-40" placeholder="Troco mínimo (R$)" value={trocoMin} onChange={(e) => setTrocoMin(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="ml-auto text-sm text-muted-foreground">{lista.length} clientes</span>
        </Card>

        {isLoading ? <Skeleton className="h-40 w-full" /> : !lista.length ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {data?.admin ? "Nenhum cliente. Envie a planilha acima." : "Nenhum cliente de quitação atribuído a você ainda."}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.slice(0, 300).map((c) => {
              const m = melhorTroco(c);
              const r = RESULTADOS[c.resultado] ?? RESULTADOS.novo;
              return (
                <Card key={c.id} className="cursor-pointer space-y-1.5 p-4 transition hover:border-primary" onClick={() => setAberto(c)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{c.nome}</p>
                    <Badge variant="secondary" className={`border-0 ${r.cls}`}>{r.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Saldo {brl(c.saldo)} · parcela {brl(c.parcela)} · {c.pagas ?? "?"}/{c.plano ?? "?"} pagas</p>
                  <p className={`text-sm font-semibold ${m && m.troco > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    Troco {m ? `${brl(m.troco)} em ${m.prazo}x` : "—"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {quaseQuitado(c) && <Badge variant="outline" className="text-[10px]">Quase quitado</Badge>}
                    {desatualizado(c) && <Badge variant="outline" className="border-amber-400 text-[10px] text-amber-700">Valores com +30 dias</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {lista.length > 300 && <p className="text-center text-xs text-muted-foreground">Mostrando 300 de {lista.length}. Use a busca ou os filtros.</p>}
      </div>
      <FichaDialog cliente={aberto} admin={!!data?.admin} consultoras={data?.consultoras ?? []} onClose={() => setAberto(null)} onChange={refresh} />
    </AppShell>
  );
}

function AdminPainel({ data, onChange }: { data: Awaited<ReturnType<typeof quitacaoListar>>; onChange: () => void }) {
  const importar = useServerFn(quitacaoImportar);
  const excluir = useServerFn(quitacaoExcluirLote);
  const [previa, setPrevia] = useState<{ nome: string; clientes: any[]; invalidos: number; existentes: number } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const porConsultora = useMemo(() => {
    const m = new Map<string, { total: number; trabalhados: number; interessados: number; fechados: number; troco: number }>();
    for (const c of data.clientes) {
      const k = c.consultant_id ?? "sem";
      const v = m.get(k) ?? { total: 0, trabalhados: 0, interessados: 0, fechados: 0, troco: 0 };
      v.total++;
      if (c.resultado !== "novo") v.trabalhados++;
      if (c.resultado === "interessado" || c.resultado === "proposta") v.interessados++;
      if (c.resultado === "fechado") v.fechados++;
      v.troco += Math.max(0, melhorTroco(c)?.troco ?? 0);
      m.set(k, v);
    }
    return [...m.entries()];
  }, [data.clientes]);
  const email = (id: string) => (id === "sem" ? "Sem consultora" : data.consultoras.find((c) => c.id === id)?.email ?? id.slice(0, 8));

  async function onFile(f: File) {
    try {
      const { clientes, invalidos } = await lerPlanilha(f);
      const chaves = new Set(data.clientes.map((c) => `${c.cpf}|${c.cod_ordem}`));
      setPrevia({ nome: f.name, clientes, invalidos, existentes: clientes.filter((c) => chaves.has(`${c.cpf}|${c.cod_ordem}`)).length });
    } catch (e) { toast.error("Não consegui ler a planilha: " + (e as Error).message); }
  }
  async function confirmar(distribuir: boolean) {
    if (!previa) return;
    setEnviando(true);
    try {
      const r = await importar({ data: { nome: previa.nome, clientes: previa.clientes, distribuir } });
      toast.success(`${r.novos} novos e ${r.atualizados} atualizados.`);
      setPrevia(null); onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setEnviando(false); }
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-primary px-3 py-2 text-sm text-primary-foreground">
          <Upload className="h-4 w-4" /> Enviar planilha
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
        <span className="text-xs text-muted-foreground">Aceita as abas "Contratos calculados" e a de prazos juntas. Reenviar a mesma planilha atualiza os valores sem duplicar.</span>
      </div>

      {previa && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="font-medium">{previa.nome}</p>
          <p>{previa.clientes.length - previa.existentes} novos · {previa.existentes} já existem (serão atualizados) · {previa.invalidos} com CPF inválido (ignorados)</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={enviando} onClick={() => confirmar(true)}>Importar e distribuir igualmente</Button>
            <Button size="sm" variant="outline" disabled={enviando} onClick={() => confirmar(false)}>Importar sem distribuir</Button>
            <Button size="sm" variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {!!data.lotes.length && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Planilhas enviadas</p>
          {data.lotes.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
              <span>{l.nome} · {l.total} clientes · {new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
              <Button size="sm" variant="ghost" className="text-rose-700" onClick={async () => {
                if (!confirm("Excluir esta planilha e todos os clientes dela?")) return;
                await excluir({ data: { loteId: l.id } }); toast.success("Planilha excluída."); onChange();
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {!!porConsultora.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Consultora</th><th>Clientes</th><th>Trabalhados</th><th>Interessados</th><th>Fechados</th><th>Troco potencial</th></tr></thead>
            <tbody>{porConsultora.map(([id, v]) => (
              <tr key={id} className="border-t"><td className="py-1">{email(id)}</td><td>{v.total}</td><td>{v.trabalhados}</td><td>{v.interessados}</td><td>{v.fechados}</td><td>{brl(v.troco)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FichaDialog({ cliente: c, admin, consultoras, onClose, onChange }: {
  cliente: QuitacaoCliente | null; admin: boolean; consultoras: { id: string; email: string }[]; onClose: () => void; onChange: () => void;
}) {
  const registrar = useServerFn(quitacaoRegistrar);
  const editar = useServerFn(quitacaoAdminEditar);
  const tel = useServerFn(quitacaoTelefones);
  const { data: fones } = useQuery({ queryKey: ["quitacao-tel", c?.cpf], enabled: !!c, queryFn: () => tel({ data: { cpf: c!.cpf } }) });
  const [nota, setNota] = useState("");
  if (!c) return null;
  const m = melhorTroco(c);
  const primeiro = c.nome.split(" ")[0];
  const msg = encodeURIComponent(`Olá, ${primeiro}! Tudo bem? Identificamos que você pode quitar seu contrato atual e ainda receber um troco estimado de ${m ? brl(m.troco) : "valor a confirmar"}${m ? ` em ${m.prazo}x` : ""}. Posso te explicar sem compromisso?`);

  async function marcar(resultado: "sem_contato" | "interessado" | "proposta" | "fechado" | "recusado") {
    try {
      await registrar({ data: { id: c!.id, resultado, nota: nota || undefined } });
      toast.success("Contato registrado."); setNota(""); onChange(); onClose();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{c.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">CPF {c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")} · Ordem {c.cod_ordem || "—"} · {c.status ?? "sem status"}</p>
          {desatualizado(c) && <p className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4" /> Valores importados há mais de 30 dias — reconfira antes de oferecer.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Info l="Saldo devedor" v={brl(c.saldo)} /><Info l="Parcela atual" v={brl(c.parcela)} />
            <Info l="Parcelas pagas" v={`${c.pagas ?? "—"} de ${c.plano ?? "—"}`} /><Info l="Em aberto" v={String(c.abertas ?? "—")} />
            <Info l="Reserva no site" v={brl(c.reserva)} /><Info l="Contratos" v={String(c.qtd_contratos ?? "—")} />
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th>Prazo</th><th>Valor bruto</th><th>Troco</th></tr></thead>
            <tbody>{PRAZOS.filter((p) => c.prazos?.[p]).map((p) => {
              const t = c.prazos[p].troco;
              return <tr key={p} className="border-t"><td className="py-1">{p}x</td><td>{brl(c.prazos[p].bruto)}</td>
                <td className={t != null && t < 0 ? "text-rose-700" : "font-medium text-emerald-700"}>{brl(t)}{t != null && t < 0 ? " · não compensa" : ""}</td></tr>;
            })}</tbody>
          </table>
          <div className="space-y-1">
            <p className="text-xs font-medium">Telefones encontrados no sistema</p>
            {!fones?.telefones.length ? (
              <p className="text-xs text-muted-foreground">Nenhum. <Link to="/consulta-servidor" search={{ q: c.cpf } as any} className="underline">Pesquisar cliente</Link></p>
            ) : fones.telefones.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="font-mono text-xs">{t}</span>
                <Button asChild size="sm" variant="outline"><a href={`tel:${t}`}><Phone className="h-3.5 w-3.5" /></a></Button>
                <Button asChild size="sm" variant="outline"><a href={`https://wa.me/55${t}?text=${msg}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a></Button>
              </div>
            ))}
          </div>
          <Input placeholder="Observação (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => marcar("sem_contato")}>Sem contato</Button>
            <Button size="sm" variant="outline" onClick={() => marcar("interessado")}>Interessado</Button>
            <Button size="sm" variant="outline" onClick={() => marcar("proposta")}>Proposta enviada</Button>
            <Button size="sm" onClick={() => marcar("fechado")}>Fechado</Button>
            <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => marcar("recusado")}>Recusado</Button>
          </div>
          {c.resultado === "fechado" && <Button asChild size="sm" variant="secondary"><Link to="/prospeccao/conversoes">Registrar venda em Minha carteira</Link></Button>}
          {admin && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue={c.consultant_id ?? ""} onChange={async (e) => {
                await editar({ data: { id: c.id, consultant_id: e.target.value || null } }); toast.success("Responsável alterado."); onChange();
              }}>
                <option value="">Sem consultora</option>
                {consultoras.map((k) => <option key={k.id} value={k.id}>{k.email}</option>)}
              </select>
              <Button size="sm" variant="ghost" className="text-rose-700" onClick={async () => {
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
