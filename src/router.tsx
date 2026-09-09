import { createRouter, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { routeTree } from "./routeTree.gen";

// Falhas de carregamento dos arquivos do app: acontecem quando o navegador
// ainda tem a versão anterior aberta depois de uma publicação e tenta baixar
// um pedaço que já não existe. Nesse caso recarregamos a página uma única vez.
const CHUNK_ERROR_PATTERNS = [
  "importing a module script failed",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "chunkloaderror",
  "loading chunk",
  "unable to preload css",
];

function isChunkError(error: Error) {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((p) => text.includes(p));
}

const RELOAD_FLAG = "app-chunk-reload";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [detalhes, setDetalhes] = useState(false);

  useEffect(() => {
    // Registra o motivo real para aparecer nos logs do navegador.
    console.error("[app] erro na tela:", error);
    if (typeof window === "undefined" || !isChunkError(error)) return;
    try {
      if (window.sessionStorage.getItem(RELOAD_FLAG)) return;
      window.sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível abrir esta tela agora. Toque em “Tentar de novo”. Se continuar,
          use “Ver detalhes” e envie a mensagem para o suporte.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
        {error?.message && (
          <div className="mt-6 text-left">
            <button
              onClick={() => setDetalhes((v) => !v)}
              className="text-xs font-medium text-muted-foreground underline underline-offset-4"
            >
              {detalhes ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
            {detalhes && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-destructive">
                {error.message}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
