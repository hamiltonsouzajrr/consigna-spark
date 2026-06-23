import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud, AlertTriangle } from "lucide-react";
import { isValidCpf, normalizeCpf, formatCpf } from "@/lib/cpf";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload de CPFs — Consulta de Margem" },
      { name: "description", content: "Importe planilhas CSV ou XLSX com CPFs e nomes para enfileirar consultas de margem consignável." },
      { property: "og:title", content: "Upload de CPFs — Consulta de Margem" },
      { property: "og:description", content: "Importe planilhas CSV ou XLSX com CPFs e nomes para enfileirar consultas de margem consignável." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/upload" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/upload" }],
  }),
  component: Page,
});

interface ValidRow { cpf: string; nome: string; }
interface InvalidRow { cpf: string; nome: string; reason: string; line: number; }

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [valid, setValid] = useState<ValidRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidRow[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [alreadyImported, setAlreadyImported] = useState(0);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const reset = () => { setValid([]); setInvalid([]); setDuplicates(0); setAlreadyImported(0); };

  const parseFile = async (file: File) => {
    reset();
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const onParsed = async (records: Record<string, unknown>[]) => {
      const ok: ValidRow[] = [];
      const bad: InvalidRow[] = [];
      const seen = new Set<string>();
      let dup = 0;
      records.forEach((r, idx) => {
        const line = idx + 2; // header is line 1
        const keys = Object.keys(r).reduce<Record<string, string>>((acc, k) => { acc[k.toLowerCase().trim()] = k; return acc; }, {});
        const cpfKey = keys["cpf"];
        const nomeKey = keys["nome"];
        if (!cpfKey || !nomeKey) {
          bad.push({ cpf: "", nome: "", line, reason: "Colunas CPF e NOME ausentes" });
          return;
        }
        const rawCpf = String(r[cpfKey] ?? "").trim();
        let cpf = normalizeCpf(rawCpf);
        const nome = String(r[nomeKey] ?? "").trim();
        if (!cpf && !nome) return; // empty row
        if (!nome) { bad.push({ cpf: rawCpf, nome: "", line, reason: "Nome vazio" }); return; }
        if (!cpf) { bad.push({ cpf: rawCpf, nome, line, reason: "CPF vazio" }); return; }
        // Pad com zeros à esquerda quando o CPF tem menos de 11 dígitos (planilhas costumam perder zeros à esquerda)
        if (cpf.length > 0 && cpf.length < 11) cpf = cpf.padStart(11, "0");
        if (cpf.length !== 11) { bad.push({ cpf: rawCpf, nome, line, reason: `CPF deve ter no máximo 11 dígitos (tem ${cpf.length})` }); return; }
        if (!isValidCpf(cpf)) { bad.push({ cpf: rawCpf, nome, line, reason: "CPF inválido (dígito verificador)" }); return; }
        if (seen.has(cpf)) { dup++; return; }
        seen.add(cpf);
        ok.push({ cpf, nome });
      });

      // Filtra CPFs já existentes na base (independente do status) — evita reconsultar até serem limpos
      let already = 0;
      let filtered = ok;
      if (ok.length) {
        setChecking(true);
        const existing = new Set<string>();
        const cpfs = ok.map((r) => r.cpf);
        const chunkSize = 500;
        for (let i = 0; i < cpfs.length; i += chunkSize) {
          const chunk = cpfs.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("consultas_margem")
            .select("cpf")
            .in("cpf", chunk);
          if (error) { toast.error(`Erro ao verificar CPFs existentes: ${error.message}`); break; }
          data?.forEach((row) => existing.add(row.cpf));
        }
        setChecking(false);
        if (existing.size) {
          filtered = ok.filter((r) => !existing.has(r.cpf));
          already = ok.length - filtered.length;
        }
      }

      setValid(filtered);
      setInvalid(bad);
      setDuplicates(dup);
      setAlreadyImported(already);
      if (!filtered.length && !bad.length && !already) toast.error("Planilha vazia ou sem colunas CPF/NOME.");
      else if (!filtered.length && already) toast.warning(`Todos os ${already} CPF(s) válidos já estão na base.`);
      else if (!filtered.length) toast.error("Nenhum CPF válido encontrado.");
      else toast.success(
        `${filtered.length} novo(s)` +
        (already ? `, ${already} já importado(s)` : "") +
        (bad.length ? `, ${bad.length} inválido(s)` : "") +
        (dup ? `, ${dup} duplicado(s)` : "")
      );
    };
    if (ext === "csv") {
      Papa.parse<Record<string, unknown>>(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => { void onParsed(res.data); },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      await onParsed(json);
    } else toast.error("Formato não suportado. Use CSV ou XLSX.");
  };

  const confirm = async () => {
    if (!valid.length) return;
    setBusy(true);
    const payload = valid.map((r) => ({ cpf: r.cpf, nome: r.nome, user_id: user.id }));
    const { error } = await supabase.from("consultas_margem").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`${valid.length} registros importados.`); nav({ to: "/consultas" }); }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">Envie CSV ou XLSX com colunas <strong>CPF</strong> e <strong>NOME</strong>. CPFs com máscara são aceitos e normalizados automaticamente.</p>
      </div>

      <Card className="p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center hover:bg-accent/50 transition">
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Clique para selecionar um arquivo</p>
            <p className="text-xs text-muted-foreground">CSV ou XLSX</p>
          </div>
          <Input
            type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
          />
          {fileName && <p className="text-xs text-primary">{fileName}{checking ? " — verificando CPFs já importados…" : ""}</p>}
        </label>
      </Card>

      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Formato esperado</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Colunas obrigatórias: <span className="font-mono">CPF</span> · <span className="font-mono">Nome</span> · <span className="font-mono">Matricula</span> · <span className="font-mono">Orgao</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            const csv = "CPF,Nome,Matricula,Orgao\n12345678901,JOAO SILVA,12345,Prefeitura de Maceio\n";
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "exemplo-importacao.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          Baixar CSV de exemplo
        </Button>
      </div>

      {(valid.length > 0 || invalid.length > 0 || alreadyImported > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-success/15 text-success border-success/30">{valid.length} novos</Badge>
          {alreadyImported > 0 && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{alreadyImported} já importados (ignorados)</Badge>
          )}
          {invalid.length > 0 && (
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">{invalid.length} inválidos</Badge>
          )}
          {duplicates > 0 && (
            <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/30">{duplicates} duplicados removidos</Badge>
          )}
        </div>
      )}

      {invalid.length > 0 && (
        <Card className="mt-4 overflow-hidden border-destructive/30">
          <div className="flex items-center gap-2 border-b bg-destructive/5 px-6 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium">Registros inválidos ({invalid.length})</p>
          </div>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Linha</TableHead><TableHead>CPF</TableHead><TableHead>Nome</TableHead><TableHead>Motivo</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {invalid.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{r.line}</TableCell>
                    <TableCell className="font-mono text-xs">{r.cpf || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.nome || "—"}</TableCell>
                    <TableCell className="text-xs text-destructive">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {valid.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <p className="font-medium">Pré-visualização</p>
              <p className="text-xs text-muted-foreground">{valid.length} registros válidos — mostrando primeiros 50</p>
            </div>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Importando…" : `Confirmar importação (${valid.length})`}
            </Button>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>CPF</TableHead><TableHead>Nome</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {valid.slice(0, 50).map((r, i) => (
                  <TableRow key={i}><TableCell className="font-mono text-xs">{formatCpf(r.cpf)}</TableCell><TableCell>{r.nome}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
