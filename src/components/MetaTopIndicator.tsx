// Indicador de meta no topo da barra, ao lado de "Chamadas hoje", para lembrar
// a consultora do quanto falta na meta do mês.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { producaoMesQueryOptions, mesAtual } from "@/lib/rh/producao";

const STORAGE_KEY = "producao-meta-mensal";

export function MetaTopIndicator() {
  const [meta, setMeta] = useState(0);

  useEffect(() => {
    const read = () => {
      try { setMeta(Number(window.localStorage.getItem(STORAGE_KEY)) || 0); } catch { /* ignore */ }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const { data } = useQuery(producaoMesQueryOptions(mesAtual()));
  const realizado = (data ?? []).reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0);
  const pct = meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : 0;

  return (
    <Link
      to="/producao/metas"
      title="Meta de produção do mês"
      className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 transition hover:bg-white/20"
    >
      <Target className="h-4 w-4 text-white/80" />
      <span className="text-sm text-white/80">Meta do mês</span>
      {meta > 0 ? (
        <>
          <span className="text-xl font-bold leading-none tabular-nums">{pct}%</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/25">
            <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
          </span>
        </>
      ) : (
        <span className="text-sm font-semibold text-white/90">definir</span>
      )}
    </Link>
  );
}
