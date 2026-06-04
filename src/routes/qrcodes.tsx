import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import QRCode from "react-qr-code";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Star, MessageSquareHeart, Instagram } from "lucide-react";

export const Route = createFileRoute("/qrcodes")({
  head: () => ({
    meta: [
      { title: "QR Codes de Avaliação | Grupo Positive" },
      { name: "description", content: "QR Codes do Reclame Aqui, Google e Instagram para clientes avaliarem e seguirem o Grupo Positive." },
    ],
  }),
  component: QrCodesPage,
});

type QrItem = {
  id: string;
  titulo: string;
  descricao: string;
  url: string;
  icon: typeof Star;
  cor: string;
};

const itens: QrItem[] = [
  {
    id: "reclameaqui",
    titulo: "Reclame Aqui",
    descricao: "Peça ao cliente para registrar a experiência positiva.",
    url: "https://www.reclameaqui.com.br/empresa/grupo-positive/",
    icon: MessageSquareHeart,
    cor: "#16a34a",
  },
  {
    id: "google",
    titulo: "Google",
    descricao: "Avaliação com estrelas no perfil do Google.",
    url: "https://g.page/r/CZX61pouEbLAEAE/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr",
    icon: Star,
    cor: "#eab308",
  },
  {
    id: "instagram",
    titulo: "Instagram",
    descricao: "Convide o cliente a seguir nosso perfil.",
    url: "https://instagram.com/grupopositive",
    icon: Instagram,
    cor: "#db2777",
  },
];

function QrCard({ item }: { item: QrItem }) {
  const Icon = item.icon;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" style={{ color: item.cor }} />
          {item.titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{item.descricao}</p>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <QRCode value={item.url} size={180} fgColor="#0f172a" bgColor="#ffffff" />
        </div>
        <Button asChild variant="outline" className="mt-auto w-full gap-2">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Abrir link
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function QrCodesPage() {
  const [fullscreen, setFullscreen] = useState<QrItem | null>(null);
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR Codes de Avaliação</h1>
          <p className="text-muted-foreground">
            Mostre estes QR Codes para os clientes escanearem e avaliarem o Grupo Positive no
            Reclame Aqui, Google e Instagram.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) => (
            <div key={item.id} onClick={() => setFullscreen(item)} className="cursor-pointer">
              <QrCard item={item} />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Toque em um card para ampliar o QR Code e facilitar a leitura pelo celular do cliente.
        </p>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/80 p-6"
          onClick={() => setFullscreen(null)}
        >
          <h2 className="text-2xl font-bold text-white">{fullscreen.titulo}</h2>
          <div className="rounded-2xl bg-white p-6">
            <QRCode value={fullscreen.url} size={260} fgColor="#0f172a" bgColor="#ffffff" />
          </div>
          <p className="text-sm text-white/80">Toque em qualquer lugar para fechar</p>
        </div>
      )}
    </AppShell>
  );
}
