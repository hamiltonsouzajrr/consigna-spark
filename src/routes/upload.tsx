import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/upload")({ component: Page });

interface Row { cpf: string; nome: string; }

function normalizeCpf(v: unknown) { return String(v ?? "").replace(/\D/g, ""); }

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const parseFile = async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const onParsed = (records: Record<string, unknown>[]) => {
      const out: Row[] = [];
      for (const r of records) {
        const keys = Object.keys(r).reduce<Record<string, string>>((acc, k) => { acc[k.toLowerCase().trim()] = k; return acc; }, {});
        const cpfKey = keys["cpf"];
        const nomeKey = keys["nome"];
        if (!cpfKey || !nomeKey) continue;
        const cpf = normalizeCpf(r[cpfKey]);
        const nome = String(r[nomeKey] ?? "").trim();
        if (cpf && nome) out.push({ cpf, nome });
      }
      if (!out.length) toast.error("Nenhum registro válido. Verifique colunas CPF e NOME.");
      setRows(out);
    };
    if (ext === "csv") {
      Papa.parse<Record<string, unknown>>(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => onParsed(res.data),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      onParsed(json);
    } else toast.error("Formato não suportado. Use CSV ou XLSX.");
  };

  const confirm = async () => {
    if (!rows.length) return;
    setBusy(true);
    const payload = rows.map((r) => ({ cpf: r.cpf, nome: r.nome, user_id: user.id }));
    const { error } = await supabase.from("consultas_margem").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`${rows.length} registros importados.`); nav({ to: "/consultas" }); }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">Envie CSV ou XLSX com colunas <strong>CPF</strong> e <strong>NOME</strong>.</p>
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
          {fileName && <p className="text-xs text-primary">{fileName}</p>}
        </label>
      </Card>

      {rows.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <p className="font-medium">Pré-visualização</p>
              <p className="text-xs text-muted-foreground">{rows.length} registros — mostrando primeiros 50</p>
            </div>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Importando…" : "Confirmar importação"}
            </Button>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>CPF</TableHead><TableHead>Nome</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}><TableCell className="font-mono text-xs">{r.cpf}</TableCell><TableCell>{r.nome}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
