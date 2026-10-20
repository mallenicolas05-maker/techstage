import type { DigestIssue } from "@/domain/digest";

export const DIGEST_EMAIL_MAX_BYTES = 102_400;

export function digestEmailHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const paragraph = (value: string) => `<p style="margin:0 0 16px;color:#343434;font:400 18px/28px Inter,Arial,sans-serif">${escapeHtml(value)}</p>`;

/**
 * Produces a conservative, inline-styled email that mirrors the web issue without
 * relying on web fonts, scripts, or external CSS. Source links are always retained.
 */
export function renderDigestEmail(issue: DigestIssue, origin = "https://techstage.com"): string {
  const panels = issue.panels.map((panel, index) => {
    const sections = panel.sections.map((section) => `
      <tr><td style="padding:14px 0 0;color:#154f43;font:700 13px/20px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">&#9656; ${escapeHtml(section.label)}</td></tr>
      ${section.useCases?.length ? `<tr><td style="padding:8px 0 2px;color:#5a5a5a;font:600 13px/20px Arial,sans-serif">${section.useCases.map(escapeHtml).join(" &nbsp;·&nbsp; ")}</td></tr>` : ""}
      <tr><td style="padding:8px 0 0">${section.paragraphs.map(paragraph).join("")}</td></tr>`).join("");
    return `
      <tr><td style="padding:38px 0 0;border-top:1px solid #d9d5cc">
        <p style="margin:0;color:#176b5b;font:600 12px/18px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">${String(index + 1).padStart(2, "0")} / ${String(issue.panels.length).padStart(2, "0")} &nbsp;·&nbsp; ${escapeHtml(panel.event)}</p>
        <h2 style="margin:12px 0 8px;color:#181818;font:700 24px/30px Inter,Arial,sans-serif">${escapeHtml(panel.title)}</h2>
        <p style="margin:0 0 22px;color:#666;font:400 14px/22px Inter,Arial,sans-serif">${panel.speakers.map((speaker) => `${escapeHtml(speaker.name)} (${escapeHtml(speaker.company)})`).join(" · ")}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${sections}</table>
        <p style="margin:8px 0 34px"><a href="${escapeHtml(panel.source.url)}" style="color:#176b5b;font:700 14px/22px Arial,sans-serif">Watch or read the official source &#8599;</a></p>
      </td></tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><style>@media(prefers-color-scheme:dark){.page{background:#17181c!important}.paper{background:#17181c!important}.ink{color:#f3f1ec!important}}[data-ogsc] .page{background:#17181c!important}[data-ogsc] .paper{background:#17181c!important}[data-ogsc] .ink{color:#f3f1ec!important}</style></head><body class="page" style="margin:0;background:#f3f0e9"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(issue.deck)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f0e9"><tr><td align="center" style="padding:24px 12px"><table class="paper" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8"><tr><td style="padding:34px 28px 12px"><p style="margin:0;color:#181818;font:700 25px/30px Georgia,serif">Stage <span style="color:#176b5b">Notes</span></p><p style="margin:8px 0 0;color:#777;font:600 11px/18px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">Issue № ${String(issue.issueNumber).padStart(3, "0")} · ${issue.readingMinutes} minute read</p><h1 class="ink" style="margin:42px 0 10px;color:#181818;font:700 28px/34px Inter,Arial,sans-serif">${escapeHtml(issue.title)}</h1><p style="margin:0 0 32px;color:#666;font:400 18px/28px Inter,Arial,sans-serif">${escapeHtml(issue.deck)}</p><p style="margin:0 0 10px;color:#176b5b;font:700 13px/20px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">&#9656; The big picture</p>${paragraph(issue.bigPicture)}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${panels}</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background:#f0ece2"><tr><td style="padding:26px"><p style="margin:0 0 14px;color:#176b5b;font:700 13px/20px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">&#9656; The through-line</p>${issue.throughLine.map(paragraph).join("")}</td></tr></table><p style="margin:34px 0 8px;text-align:center"><a href="${origin}/notes/${encodeURIComponent(issue.slug)}" style="color:#176b5b;font:700 14px/22px Arial,sans-serif">View in browser / read the complete issue</a></p><p style="margin:0 0 8px;text-align:center;color:#777;font:400 11px/18px Arial,sans-serif">You received this because you confirmed a Stage Notes subscription. <a href="${origin}/notes/preferences" style="color:#555">Unsubscribe or manage preferences</a>.</p><p style="margin:0 0 22px;text-align:center;color:#777;font:400 11px/18px Arial,sans-serif">TechStage · [Physical mailing address required before launch]</p></td></tr></table></td></tr></table></body></html>`;

  if (new TextEncoder().encode(html).length > DIGEST_EMAIL_MAX_BYTES) {
    throw new Error("Digest email exceeds the 102 KB delivery ceiling");
  }
  return html;
}
