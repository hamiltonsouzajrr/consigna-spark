import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { colaboradores, brl } from "@/lib/rh/mock";
import {
  upsertProducaoBatch,
  mesAtual,
  type ProducaoInput,
} from "@/lib/rh/producao";

type ParsedRow = {
  linha: number;
  consultora: string;
  valor: number;
  contratos: number;
  mes: string;
  erros: string[];
};

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return String(row[k] ?? "").trim();
  }
  return "";
}

function parseNumber(s: string): number {
  if (!s) return NaN;
  // remove R$, espaços e separador de milhar; vírgula -> ponto
  const clean = s.replace(/[r$\s.]/gi, "").replace(",", ".");
  return Number(clean);
}

export function ImportProducaoDialog({
  defaultMes,
  userId,
}: {
  defaultMes: string;
  userId?: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState(defaultMes || mesAtual());
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  const validNames = new Set(colaboradores.map((c) => c.nome.toLowerCase()));
  const depDe = (nome: string) =>
    colaboradores.find((c) => c.nome.toLowerCase() === nome.toLowerCase())?.departamento ?? null;

  const validar = (parsed: ParsedRow[]) => {
    const seen = new Set<string>();
    return parsed.map((r) => {
      const erros: string[] = [];
      if (!r.consultora) erros.push("Consultora obrigatória");
      else if (!validNames.has(r.consultora.toLowerCase()))
        erros.push("Consultora não encontrada");
      if (isNaN(r.valor) || r.valor < 0) erros.push("Valor inválido");
      if (isNaN(r.contratos) || r.contratos < 0 || !Number.isInteger(r.contratos))
        erros.push("Contratos inválido");
      if (!MES_RE.test(r.mes)) erros.push("Mês inválido (YYYY-MM)");
      const key = `${r.consultora.toLowerCase()}|${r.mes}`;
      if (r.consultora && MES_RE.test(r.mes)) {
        if (seen.has(key)) erros.push("Duplicada na planilha");
        seen.add(key);
      }
      return { ...r, erros };
    });
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: ParsedRow[] = json.map((row, i) => {
        const mesRaw = pick(row, ["mes", "mês", "referencia", "referência"]);
        return {
          linha: i + 2,
          consultora: pick(row, ["consultora", "nome", "colaboradora", "colaborador"]),
          valor: parseNumber(pick(row, ["valor", "valor produzido", "producao", "produção"])),
          contratos: parseNumber(pick(row, ["contratos", "qtd", "quantidade"])),
          mes: mesRaw || mes,
          erros: [],
        };
      });
      setRows(validar(parsed));
    } catch {
      toast.error("Não foi possível ler a planilha", {
        description: "Use um arquivo .xlsx, .xls ou .csv válido.",
      });
    }
  };

  const reValidarMes = (novoMes: string) => {
    setMes(novoMes);
    setRows((prev) =>
      validar(prev.map((r) => ({ ...r, mes: MES_RE.test(r.mes) ? r.mes : novoMes }))),
    );
  };

  const validos = rows.filter((r) => r.erros.length === 0);
  const invalidos = rows.filter((r) => r.erros.length > 0);

  const onImport = async () => {
    if (!validos.length) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }
    setSaving(true);
    try {
      const inputs: ProducaoInput[] = validos.map((r) => ({
        consultora: r.consultora,
        departamento: depDe(r.consultora),
        mes: r.mes,
        valor: r.valor,
        contratos: r.contratos,
      }));
      await upsertProducaoBatch(inputs, userId);
      qc.invalidateQueries({ queryKey: ["rh", "producao"] });
      toast.success(`${inputs.length} lançamento(s) importado(s)`);
      setRows([]);
      setFileName("");
      setOpen(false);
    } catch (e: any) {
      toast.error("Falha ao importar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["consultora", "valor", "contratos", "mes"],
      [colaboradores[0]?.nome ?? "Nome da consultora", 15000, 3, mes],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Producao");
    XLSX.writeFile(wb, "modelo-producao.xlsx");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setRows([]);
          setFileName("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produção em lote</DialogTitle>
          <DialogDescription>
            Envie uma planilha (.xlsx, .xls ou .csv) com as colunas{" "}
            <strong>consultora</strong>, <strong>valor</strong>, <strong>contratos</strong> e,
            opcionalmente, <strong>mes</strong> (YYYY-MM).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Mês padrão</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => reValidarMes(e.target.value || mesAtual())}
              className="w-[160px]"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={baixarModelo}>
            <Download className="mr-2 h-4 w-4" /> Baixar modelo
          </Button>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <FileSpreadsheet className="h-7 w-7" />
          {fileName ? (
            <span className="font-medium text-foreground">{fileName}</span>
          ) : (
            <span>Clique para selecionar a planilha</span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {validos.length} válida(s)
              </Badge>
              {invalidos.length > 0 && (
                <Badge variant="secondary" className="border-0 bg-rose-100 text-rose-700">
                  <AlertTriangle className="mr-1 h-3 w-3" /> {invalidos.length} com erro
                </Badge>
              )}
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
              {rows.map((r) => (
                <div
                  key={r.linha}
                  className={`flex items-center gap-2 rounded-md p-1.5 text-sm ${
                    r.erros.length ? "bg-rose-50 dark:bg-rose-500/10" : ""
                  }`}
                >
                  <span className="w-8 shrink-0 text-center text-xs text-muted-foreground">
                    {r.linha}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.consultora || "—"}</span>
                  <span className="hidden tabular-nums sm:inline">
                    {isNaN(r.valor) ? "—" : brl(r.valor)}
                  </span>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {isNaN(r.contratos) ? "—" : `${r.contratos}c`}
                  </span>
                  {r.erros.length > 0 && (
                    <span className="shrink-0 text-xs text-rose-600">{r.erros.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={onImport} disabled={saving || validos.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            {saving ? "Importando…" : `Importar ${validos.length || ""} válida(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
