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
