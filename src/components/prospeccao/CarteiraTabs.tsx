// Abas da carteira da consultora: clientes convertidos e amortização mensal.
import { Link, useLocation } from "@tanstack/react-router";
import { Wallet, PiggyBank } from "lucide-react";

const ABAS = [
  { to: "/prospeccao/conversoes", label: "Meus clientes", icon: Wallet },
  { to: "/prospeccao/amortizacao", label: "Amortização do mês", icon: PiggyBank },
] as const;

export function CarteiraTabs() {
  const loc = useLocation();
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {ABAS.map((a) => {
        const ativo = loc.pathname === a.to;
        const Icon = a.icon;
        return (
          <Link
            key={a.to}
            to={a.to}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
              ativo ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" /> {a.label}
          </Link>
        );
      })}
    </div>
  );
}
