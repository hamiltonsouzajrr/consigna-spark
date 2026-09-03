import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type Props = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  variant?: "default" | "destructive" | string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode; // trigger element (uncontrolled usage)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Quando definido, exige digitar exatamente este texto para liberar a ação. */
  requireText?: string;
};

/** Accessible replacement for window.confirm on destructive admin actions. */
export function ConfirmDialog({
  title, description, confirmLabel = "Confirmar", destructive, variant,
  onConfirm, children, open: openProp, onOpenChange, requireText,
}: Props) {
  const [typed, setTyped] = useState("");
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!controlled) setOpenState(v);
    if (v) setTyped("");
    onOpenChange?.(v);
  };
  const isDestructive = destructive || variant === "destructive";
  const blocked = !!requireText && typed.trim().toUpperCase() !== requireText.toUpperCase();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children ? <span onClick={() => setOpen(true)} className="contents">{children}</span> : null}
      <AlertDialogContent>

        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div className="text-sm text-muted-foreground">{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        {requireText && (
          <div className="space-y-1.5">
            <label htmlFor="confirm-text" className="text-xs text-muted-foreground">
              Para confirmar, digite <span className="font-semibold text-foreground">{requireText}</span>
            </label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              autoComplete="off"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (blocked) { e.preventDefault(); return; }
              void onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
