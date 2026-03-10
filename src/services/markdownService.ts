function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('blob:')
    || normalized.startsWith('data:image/');
}

function renderInline(markdown: string): string {
  let html = escapeHtml(markdown);

  html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_all, alt: string, url: string) => {
    const safeUrl = isSafeUrl(url) ? url : '';
    if (!safeUrl) return '';
    return `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_all, label: string, url: string) => {
    const safeUrl = isSafeUrl(url) ? url : '#';
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });

  return html;
}

function closeListIfNeeded(parts: string[], inList: boolean, inChecklist: boolean): { inList: boolean; inChecklist: boolean } {
  if (inList || inChecklist) {
    parts.push('</ul>');
    return { inList: false, inChecklist: false };
  }
  return { inList, inChecklist };
}

function splitTableRow(line: string): string[] {
  const normalized = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return normalized.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function renderTable(headerLine: string, separatorLine: string, rowLines: string[]): string {
  const headerCells = splitTableRow(headerLine);
  const separatorCells = splitTableRow(separatorLine);
  if (headerCells.length < 2 || separatorCells.length !== headerCells.length) {
    return `<p>${renderInline(headerLine)}</p>`;
  }

  const alignments = separatorCells.map((cell) => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(':');
    const right = trimmed.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  const headHtml = headerCells
    .map((cell, index) => `<th style="text-align:${alignments[index]}">${renderInline(cell)}</th>`)
    .join('');

  const bodyHtml = rowLines
    .map((line) => {
      const cells = splitTableRow(line);
      const rendered = headerCells.map((_, index) => `<td style="text-align:${alignments[index]}">${renderInline(cells[index] || '')}</td>`).join('');
      return `<tr>${rendered}</tr>`;
    })
    .join('');

  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  let inList = false;
  let inChecklist = false;
  let inCode = false;
  let codeBuffer: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const raw = line.trimEnd();

    if (raw.trim().startsWith('```')) {
      if (!inCode) {
        ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
        inCode = true;
        codeBuffer = [];
      } else {
        parts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        inCode = false;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
      continue;
    }

    const next = lines[index + 1]?.trimEnd() || '';
    if (trimmed.includes('|') && isTableSeparator(next)) {
      ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
      const tableRows: string[] = [];
      let cursor = index + 2;
      while (cursor < lines.length) {
        const row = lines[cursor].trimEnd();
        if (!row.trim() || !row.includes('|')) break;
        tableRows.push(row.trim());
        cursor += 1;
      }
      parts.push(renderTable(trimmed, next.trim(), tableRows));
      index = cursor - 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
      parts.push(`<blockquote>${renderInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    const checklistMatch = trimmed.match(/^[-*]\s+\[(\s|x|X)\]\s+(.+)$/);
    if (checklistMatch) {
      if (!inChecklist) {
        ({ inList } = closeListIfNeeded(parts, inList, false));
        parts.push('<ul class="markdown-checklist">');
        inChecklist = true;
      }
      const checked = checklistMatch[1].toLowerCase() === 'x';
      parts.push(`<li><label><input type="checkbox" disabled ${checked ? 'checked' : ''} /> ${renderInline(checklistMatch[2])}</label></li>`);
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (inChecklist) {
        ({ inChecklist } = closeListIfNeeded(parts, false, inChecklist));
      }
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${renderInline(listMatch[1])}</li>`);
      continue;
    }

    ({ inList, inChecklist } = closeListIfNeeded(parts, inList, inChecklist));
    parts.push(`<p>${renderInline(trimmed)}</p>`);
  }

  if (inCode) {
    parts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }

  closeListIfNeeded(parts, inList, inChecklist);

  return parts.join('');
}
