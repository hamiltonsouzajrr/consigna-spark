import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
};

/** Accessible replacement for window.confirm on destructive admin actions. */
export function ConfirmDialog({
  title, description, confirmLabel = "Confirmar", destructive, variant,
  onConfirm, children, open: openProp, onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!controlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const isDestructive = destructive || variant === "destructive";
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children ? <span onClick={() => setOpen(true)} className="contents">{children}</span> : null}
      <AlertDialogContent>

        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div className="text-sm text-muted-foreground">{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={() => { void onConfirm(); }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
