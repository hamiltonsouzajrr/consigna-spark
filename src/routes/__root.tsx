import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Início
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Consulta de Margem Consignável" },
      { name: "description", content: "Sistema administrativo para consulta de margens consignáveis." },
      { property: "og:title", content: "Consulta de Margem Consignável" },
      { name: "twitter:title", content: "Consulta de Margem Consignável" },
      { property: "og:description", content: "Sistema administrativo para consulta de margens consignáveis." },
      { name: "twitter:description", content: "Sistema administrativo para consulta de margens consignáveis." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/s56d0ytBa5fL79YSjl4Ln1u2ALh1/social-images/social-1778003844283-logo.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/s56d0ytBa5fL79YSjl4Ln1u2ALh1/social-images/social-1778003844283-logo.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
