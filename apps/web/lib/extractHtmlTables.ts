export type ParsedHtmlTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

function cellText(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function rowCells(tr: Element): string[] {
  const cells = tr.querySelectorAll("th, td");
  return Array.from(cells).map((c) => cellText(c));
}

/** Pull simple tables from HTML findings uploads (browser only). */
export function extractHtmlTables(html: string, defaultTitle = "Imported table"): ParsedHtmlTable[] {
  if (typeof DOMParser === "undefined" || !html.includes("<table")) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  return tables
    .map((table, index) => {
      const caption = cellText(table.querySelector("caption"));
      const title = caption || `${defaultTitle} ${index + 1}`;
      const theadRows = table.querySelectorAll("thead tr");
      const bodyRows = table.querySelectorAll("tbody tr");
      const allRows = table.querySelectorAll("tr");
      let headers: string[] = [];
      let dataRows: string[][] = [];

      if (theadRows.length > 0) {
        headers = rowCells(theadRows[0]);
        const bodySource = bodyRows.length > 0 ? bodyRows : allRows;
        dataRows = Array.from(bodySource)
          .map((tr) => rowCells(tr))
          .filter((r) => r.some(Boolean));
      } else if (allRows.length > 0) {
        headers = rowCells(allRows[0]);
        dataRows = Array.from(allRows)
          .slice(1)
          .map((tr) => rowCells(tr))
          .filter((r) => r.some(Boolean));
      }

      if (!headers.length && !dataRows.length) return null;
      if (!headers.length && dataRows.length) {
        const width = Math.max(...dataRows.map((r) => r.length), 1);
        headers = Array.from({ length: width }, (_, i) => `Col ${i + 1}`);
      }
      return { title, headers, rows: dataRows };
    })
    .filter((t): t is ParsedHtmlTable => !!t && (t.headers.length > 0 || t.rows.length > 0));
}
