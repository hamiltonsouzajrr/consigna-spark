// Tabela de metas x realizado por consultora, com edição da meta individual.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Pencil, RotateCcw, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LinhaMeta, MetasSemana } from "@/lib/prospeccao/metas.functions";

function pct(feito: number, meta: number) {
  if (meta <= 0) return 100;
  return Math.round((feito / meta) * 100);
}

function Coluna({
  feito,
  meta,
  pctEsperado,
  sufixo,
}: {
  feito: number;
  meta: number;
  pctEsperado: number;
  sufixo?: string;
}) {
  const p = pct(feito, meta);
  const atrasada = p < pctEsperado;
  return (
    <div className="min-w-[110px] space-y-1">
      <div className="flex items-baseline gap-1 text-sm">
        <span className={`font-semibold tabular-nums ${atrasada ? "text-destructive" : "text-foreground"}`}>
          {feito.toLocaleString("pt-BR")}
          {sufixo}
        </span>
        <span className="text-xs text-muted-foreground">
          / {meta.toLocaleString("pt-BR")}
          {sufixo}
        </span>
      </div>
      <Progress value={Math.min(100, p)} className="h-1.5" />
      <p className={`text-xs ${atrasada ? "text-destructive" : "text-muted-foreground"}`}>{p}%</p>
    </div>
  );
}

export function MetasTable({
  dados,
  onSalvar,
  onRemover,
  salvando,
}: {
  dados: MetasSemana;
  onSalvar: (v: { userId: string; meta_contatos: number; meta_vendas: number; meta_horas: number }) => void;
  onRemover: (userId: string) => void;
  salvando: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ meta_contatos: 0, meta_vendas: 0, meta_horas: 0 });

  const abrir = (l: LinhaMeta) => {
    setEditando(l.user_id);
    setRascunho({ ...l.meta });
  };

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Consultora</TableHead>
            <TableHead>Contatos</TableHead>
            <TableHead>Vendas confirmadas</TableHead>
            <TableHead>Horas ativas</TableHead>
            <TableHead className="text-right">Meta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.linhas.map((l) => {
            const emEdicao = editando === l.user_id;
            return (
              <TableRow key={l.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.nome}</span>
                    {l.individual ? (
                      <Badge variant="outline" className="text-xs">
                        meta própria
                      </Badge>
                    ) : null}
                    <Link
                      to="/prospeccao/minha-semana"
                      className="text-muted-foreground hover:text-foreground"
                      title="Abrir a tela Minha semana"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </TableCell>

                {emEdicao ? (
                  <>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={rascunho.meta_contatos}
                        onChange={(e) => setRascunho((r) => ({ ...r, meta_contatos: Number(e.target.value) }))}
                        className="h-9 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={rascunho.meta_vendas}
                        onChange={(e) => setRascunho((r) => ({ ...r, meta_vendas: Number(e.target.value) }))}
                        className="h-9 w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={rascunho.meta_horas}
                        onChange={(e) => setRascunho((r) => ({ ...r, meta_horas: Number(e.target.value) }))}
                        className="h-9 w-20"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          disabled={salvando}
                          onClick={() => {
                            onSalvar({ userId: l.user_id, ...rascunho });
                            setEditando(null);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <Coluna feito={l.contatos} meta={l.meta.meta_contatos} pctEsperado={dados.pctEsperado} />
                    </TableCell>
                    <TableCell>
                      <Coluna feito={l.vendas} meta={l.meta.meta_vendas} pctEsperado={dados.pctEsperado} />
                    </TableCell>
                    <TableCell>
                      <Coluna feito={l.horas} meta={l.meta.meta_horas} pctEsperado={dados.pctEsperado} sufixo="h" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => abrir(l)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Ajustar
                        </Button>
                        {l.individual ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Voltar para a meta padrão da equipe"
                            disabled={salvando}
                            onClick={() => onRemover(l.user_id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            );
          })}
          {dados.linhas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Nenhuma consultora cadastrada.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
