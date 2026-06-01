import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportRow {
  [key: string]: string | number | null | undefined;
}

export function exportCSV(filename: string, headers: string[], rows: ReportRow[]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(title: string, filename: string, headers: string[], rows: ReportRow[]) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(32, 78, 56); // Forest green
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [headers],
    body: rows.map((row) => headers.map((h) => String(row[h] ?? "—"))),
    theme: "striped",
    headStyles: {
      fillColor: [32, 78, 56],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [245, 243, 239],
    },
  });

  doc.save(`${filename}.pdf`);
}

interface ReportCardSection {
  heading: string;
  headers: string[];
  rows: ReportRow[];
  emptyText?: string;
}

interface ReportCardOptions {
  studentName: string;
  childEmail?: string | null;
  termLabel?: string;
  institutionName?: string;
  summary?: { label: string; value: string }[];
  sections: ReportCardSection[];
  tutorComments?: string[];
  filename: string;
}

export function exportReportCardPDF(opts: ReportCardOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(32, 78, 56);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.text(opts.institutionName || "Litu Hub", 14, 12);
  doc.setFontSize(11);
  doc.text("Student Report Card", 14, 20);
  doc.setFontSize(9);
  doc.text(
    new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth - 14, 20, { align: "right" },
  );

  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.text(opts.studentName, 14, 40);
  doc.setFontSize(10);
  doc.setTextColor(90);
  const subline = [opts.childEmail, opts.termLabel].filter(Boolean).join("  •  ");
  if (subline) doc.text(subline, 14, 46);

  let cursorY = 54;

  if (opts.summary?.length) {
    const colW = (pageWidth - 28) / opts.summary.length;
    opts.summary.forEach((s, i) => {
      const x = 14 + i * colW;
      doc.setDrawColor(220);
      doc.setFillColor(245, 243, 239);
      doc.roundedRect(x, cursorY, colW - 4, 18, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(s.label.toUpperCase(), x + 4, cursorY + 6);
      doc.setFontSize(12);
      doc.setTextColor(32, 78, 56);
      doc.text(s.value, x + 4, cursorY + 14);
    });
    cursorY += 26;
  }

  for (const section of opts.sections) {
    if (cursorY > 250) { doc.addPage(); cursorY = 20; }
    doc.setFontSize(12);
    doc.setTextColor(32, 78, 56);
    doc.text(section.heading, 14, cursorY);
    cursorY += 2;

    if (!section.rows.length) {
      cursorY += 6;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(section.emptyText || "No data for this period.", 14, cursorY);
      cursorY += 8;
      continue;
    }

    autoTable(doc, {
      startY: cursorY + 2,
      head: [section.headers],
      body: section.rows.map((r) => section.headers.map((h) => String(r[h] ?? "—"))),
      theme: "striped",
      headStyles: { fillColor: [32, 78, 56], textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 243, 239] },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 10;
  }

  if (opts.tutorComments?.length) {
    if (cursorY > 250) { doc.addPage(); cursorY = 20; }
    doc.setFontSize(12);
    doc.setTextColor(32, 78, 56);
    doc.text("Tutor Comments", 14, cursorY);
    cursorY += 6;
    doc.setFontSize(10);
    doc.setTextColor(40);
    for (const c of opts.tutorComments) {
      const lines = doc.splitTextToSize(`• ${c}`, pageWidth - 28);
      if (cursorY + lines.length * 5 > 280) { doc.addPage(); cursorY = 20; }
      doc.text(lines, 14, cursorY);
      cursorY += lines.length * 5 + 2;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  doc.save(`${opts.filename}.pdf`);
}

