import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search, Plus, FileSpreadsheet, FileDown, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import {
  colaboradores as seed, departamentos, cargos, brl, formatDate,
  type Colaborador,
} from "@/lib/rh/mock";
import { exportExcel, exportPdf } from "@/lib/rh/export";

export const Route = createFileRoute("/rh/colaboradores")({
  component: Colaboradores,
});

const PAGE_SIZE = 8;
type SortKey = "nome" | "salario" | "admissao";

function Colaboradores() {
  const [data, setData] = useState<Colaborador[]>(seed);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [depto, setDepto] = useState("todos");
  const [sort, setSort] = useState<SortKey>("nome");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Colaborador | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const filtered = useMemo(() => {
    let r = data.filter((c) => {
      const matchQ =
        !q ||
        c.nome.toLowerCase().includes(q.toLowerCase()) ||
        c.cpf.includes(q) ||
        c.email.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "todos" || c.status === status;
      const matchD = depto === "todos" || c.departamento === depto;
      return matchQ && matchS && matchD;
    });
    r = [...r].sort((a, b) => {
      let cmp = 0;
      if (sort === "nome") cmp = a.nome.localeCompare(b.nome);
      else if (sort === "salario") cmp = a.salario - b.salario;
      else cmp = a.admissao.localeCompare(b.admissao);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [data, q, status, depto, sort, asc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else { setSort(key); setAsc(true); }
  };

  const handleExcel = () =>
    exportExcel(
      "colaboradores",
      filtered.map((c) => ({
        Nome: c.nome, CPF: c.cpf, "E-mail": c.email, Telefone: c.telefone,
        Cargo: c.cargo, Departamento: c.departamento, Gestor: c.gestor,
        Admissão: formatDate(c.admissao), Salário: c.salario, Status: c.status,
      })),
    );

  const handlePdf = () =>
    exportPdf(
      "Colaboradores",
      ["Nome", "Cargo", "Departamento", "Admissão", "Salário", "Status"],
      filtered.map((c) => [c.nome, c.cargo, c.departamento, formatDate(c.admissao), brl(c.salario), c.status]),
    );

  return (
    <div>
      <RhPageHeader
        title="Colaboradores"
        description={`${filtered.length} colaborador(es) encontrado(s).`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf}>
              <FileDown className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Novo Colaborador</Button>
              </DialogTrigger>
              <NovoColaboradorDialog onClose={() => setNovoOpen(false)} />
            </Dialog>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, CPF ou e-mail..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Afastado">Afastado</SelectItem>
              <SelectItem value="Férias">Férias</SelectItem>
              <SelectItem value="Desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={depto} onValueChange={(v) => { setDepto(v); setPage(1); }}>
            <SelectTrigger className="md:w-52"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os departamentos</SelectItem>
              {departamentos.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort("nome")}>
                    Nome <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>CPF</TableHead>
                <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                <TableHead className="hidden md:table-cell">Departamento</TableHead>
                <TableHead className="hidden xl:table-cell">Gestor</TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("admissao")}>
                    Admissão <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("salario")}>
                    Salário <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={c.foto} alt={c.nome} />
                      <AvatarFallback>{c.nome.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{c.cargo}</div>
                  </TableCell>
                  <TableCell className="text-sm">{c.cpf}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{c.cargo}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{c.departamento}</TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">{c.gestor}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{formatDate(c.admissao)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{brl(c.salario)}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link to="/rh/colaboradores/$id" params={{ id: c.id }}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toast.info(`Editar ${c.nome}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600"
                        onClick={() => setToDelete(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-3">
          <p className="text-sm text-muted-foreground">Página {current} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `Tem certeza que deseja excluir ${toDelete.nome}? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (toDelete) {
                  setData((d) => d.filter((x) => x.id !== toDelete.id));
                  toast.success(`${toDelete.nome} excluído.`);
                  setToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovoColaboradorDialog({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); toast.success("Colaborador cadastrado (demonstração)."); onClose(); }}
      >
        <div className="sm:col-span-2"><Label>Nome completo</Label><Input required className="mt-1" /></div>
        <div><Label>CPF</Label><Input className="mt-1" /></div>
        <div><Label>E-mail</Label><Input type="email" className="mt-1" /></div>
        <div>
          <Label>Cargo</Label>
          <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cargos.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Departamento</Label>
          <Select><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{departamentos.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
