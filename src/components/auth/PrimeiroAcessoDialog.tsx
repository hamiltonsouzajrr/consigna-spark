import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BadgeCheck, IdCard, Mail, UserRound } from "lucide-react";

export const AVISO_PRIMEIRO_ACESSO_KEY = "positive:aviso-primeiro-acesso:v1";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriarConta: () => void;
};

const itens = [
  {
    icon: UserRound,
    title: "Nome completo",
    desc: "Igual ao cadastro do RH — é assim que seus leads e metas são vinculados.",
  },
  {
    icon: IdCard,
    title: "CPF",
    desc: "Apenas uma conta por CPF. Use o seu próprio número.",
  },
  {
    icon: Mail,
    title: "E-mail válido e ativo",
    desc: "Um e-mail que você realmente acessa, no celular ou no computador.",
  },
];

export function PrimeiroAcessoDialog({ open, onOpenChange, onCriarConta }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Sistema atualizado — crie sua nova conta
          </DialogTitle>
          <DialogDescription className="text-left">
            Passamos por melhorias e os acessos anteriores foram redefinidos. O cadastro é rápido e
            feito uma única vez.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {itens.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex gap-3 rounded-lg border p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Atenção ao e-mail:</span> sem um e-mail
            correto não é possível recuperar a senha. Você também pode pedir a recuperação informando
            o CPF, mas o link de redefinição é sempre enviado para o e-mail cadastrado.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Já tenho conta / Entrar
          </Button>
          <Button className="h-11" onClick={onCriarConta}>
            Criar minha conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
