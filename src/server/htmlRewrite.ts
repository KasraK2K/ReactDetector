const marker = "data-reactdetector-runtime";

export function injectInspectorScript(html: string): string {
  if (html.includes(marker)) {
    return html;
  }

  const script = `<script defer src="/__rd/inspector.js" ${marker}="true"></script>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}</head>`);
  }

  return `${script}${html}`;
}

export function filterPreviewHeaders(
  headers: Record<string, string | string[] | number | undefined>,
  changedBody: boolean
): Record<string, string | string[] | number> {
  const filtered: Record<string, string | string[] | number> = {};
  const blocked = new Set([
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "frame-options"
  ]);

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    const lower = key.toLowerCase();
    if (blocked.has(lower)) {
      continue;
    }

    if (changedBody && (lower === "content-length" || lower === "content-encoding")) {
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

