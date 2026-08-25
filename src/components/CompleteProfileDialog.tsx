import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { completeMyProfile, getMyProfile } from "@/lib/auth/account.functions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";

/**
 * Contas criadas antes da regra "um CPF por conta" ainda não têm perfil.
 * Na primeira entrada, pedimos nome e CPF uma única vez.
 */
export function CompleteProfileDialog() {
  const { user } = useAuth();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(completeMyProfile);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchProfile()
      .then((p) => {
        if (!alive) return;
        if (!p?.cpf) {
          setNome((user.user_metadata?.nome_completo as string) ?? "");
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const salvar = async () => {
    if (nome.trim().length < 3) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido", { description: "Confira os números digitados." });
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ data: { nome: nome.trim(), cpf: normalizeCpf(cpf) } });
      toast.success("Cadastro completo!");
      setOpen(false);
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message, duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Complete seu cadastro</DialogTitle>
          <DialogDescription>
            Para sua segurança, cada conta precisa estar vinculada a um CPF. É permitido apenas um
            cadastro por CPF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(normalizeCpf(e.target.value).slice(0, 11)))}
              placeholder="000.000.000-00"
              className="h-11"
            />
          </div>
          <Button className="h-11 w-full" disabled={busy || !nome || !cpf} onClick={salvar}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
