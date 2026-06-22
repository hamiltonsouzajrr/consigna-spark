// Client-side text extraction for Radar Diário Oficial.
// Supports PDF (pdfjs + OCR fallback), TXT, HTML and DOCX (mammoth).
// Also detects basic metadata: órgão, data de publicação, número da edição.

export type ExtractResult = {
  text: string;
  tipo: string;
  data_publicacao: string; // YYYY-MM-DD or ""
  numero_edicao: string;
  orgao: string;
};

type TextItem = { str?: string; transform?: number[] };

async function readTextContent(page: any): Promise<{ items: TextItem[] }> {
  const textContent = { items: [] as TextItem[] };
  const stream = typeof page.streamTextContent === "function" ? page.streamTextContent() : null;
  if (stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.items?.length) textContent.items.push(...value.items);
      }
    } finally {
      reader.releaseLock?.();
    }
    return textContent;
  }
  return page.getTextContent();
}

async function extractPdf(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  const ocrPages: number[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    let pageLineCount = 0;
    try {
      const content = await readTextContent(page);
      const rows = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!item.str || !item.transform) continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ x, str: item.str });
      }
      const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
      for (const y of sortedY) {
        const parts = rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.str);
        const line = parts.join(" ").replace(/\s+/g, " ").trim();
        if (line) {
          lines.push(`[p.${p}] ${line}`);
          pageLineCount += 1;
        }
      }
    } catch (error) {
      console.warn(`[radar] extração de texto falhou na página ${p}; tentando OCR`, error);
    }
    if (pageLineCount === 0) ocrPages.push(p);
  }

  if (ocrPages.length === 0) return lines.join("\n");

  onProgress?.("Documento escaneado — usando OCR (pode demorar)…");
  const { default: Tesseract } = await import("tesseract.js");
  for (const p of ocrPages) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.75 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = await Tesseract.recognize(canvas, "por");
    for (const raw of (data.text ?? "").split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line) lines.push(`[p.${p}] ${line}`);
    }
  }
  return lines.join("\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return String(value ?? "").trim();
}

function extractHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
  return (doc.body?.innerText || doc.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

const MONTHS: Record<string, string> = {
  janeiro: "01", fevereiro: "02", "março": "03", marco: "03", abril: "04", maio: "05",
  junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10",
  novembro: "11", dezembro: "12",
};

function detectDataPublicacao(text: string): string {
  const head = text.slice(0, 6000);
  // dd/mm/yyyy
  const m1 = head.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // "12 de junho de 2026"
  const m2 = head.match(/\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/i);
  if (m2) {
    const mes = MONTHS[m2[2].toLowerCase()];
    if (mes) return `${m2[3]}-${mes}-${m2[1].padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  const m3 = head.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
  return "";
}

function detectEdicao(text: string): string {
  const head = text.slice(0, 6000);
  const m = head.match(/(?:edi[cç][aã]o|n[º°o.]{0,2}|n[uú]mero)\s*[:\-]?\s*([\d.]{1,12})/i);
  return m ? m[1].replace(/\.$/, "") : "";
}

function detectOrgao(text: string): string {
  const head = text.slice(0, 8000);
  const lines = head.split(/\n|\s{2,}/).map((l) => l.trim());
  const re = /(secretaria|prefeitura|governo|minist[eé]rio|tribunal|c[aâ]mara|assembleia|universidade|instituto|funda[cç][aã]o|autarquia|departamento|ag[eê]ncia|superintend[eê]ncia|procuradoria|defensoria)\b[^.\n]{0,80}/i;
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[0].replace(/\s+/g, " ").replace(/[-–:|,;]+$/, "").trim().slice(0, 200);
  }
  return "";
}

export async function extractFile(file: File, onProgress?: (msg: string) => void): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() || "";
  let text = "";
  let tipo = ext.toUpperCase();

  if (ext === "pdf") {
    text = await extractPdf(file, onProgress);
    tipo = "PDF";
  } else if (ext === "docx") {
    text = await extractDocx(file);
    tipo = "DOCX";
  } else if (ext === "html" || ext === "htm") {
    text = extractHtml(await file.text());
    tipo = "HTML";
  } else if (ext === "txt") {
    text = (await file.text()).trim();
    tipo = "TXT";
  } else {
    // Best effort: treat as text.
    text = (await file.text()).trim();
    tipo = ext.toUpperCase() || "TXT";
  }

  return {
    text,
    tipo,
    data_publicacao: detectDataPublicacao(text),
    numero_edicao: detectEdicao(text),
    orgao: detectOrgao(text),
  };
}
