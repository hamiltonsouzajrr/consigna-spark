import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPdf(title: string, columns: string[], rows: (string | number)[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);

  const startX = 14;
  let y = 26;
  const colWidth = (doc.internal.pageSize.getWidth() - startX * 2) / columns.length;

  doc.setFont("helvetica", "bold");
  columns.forEach((c, i) => doc.text(String(c), startX + i * colWidth, y));
  doc.setFont("helvetica", "normal");
  y += 6;

  rows.forEach((row) => {
    if (y > doc.internal.pageSize.getHeight() - 12) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      const text = String(cell ?? "");
      doc.text(text.length > 22 ? text.slice(0, 21) + "…" : text, startX + i * colWidth, y);
    });
    y += 6;
  });

  doc.save(`${title}.pdf`);
}
