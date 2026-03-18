import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../src-vite/services/markdownService';

describe('markdownToHtml', () => {
  it('renders table syntax', () => {
    const input = `| Col A | Col B |\n| --- | ---: |\n| a1 | b1 |`;
    const html = markdownToHtml(input);

    expect(html).toContain('<table>');
    expect(html).toContain('<th style="text-align:left">Col A</th>');
    expect(html).toContain('<th style="text-align:right">Col B</th>');
    expect(html).toContain('<td style="text-align:right">b1</td>');
  });

  it('renders checklist and images', () => {
    const input = `- [x] Done\n- [ ] Todo\n\n![Alt](https://example.com/image.png)`;
    const html = markdownToHtml(input);

    expect(html).toContain('class="markdown-checklist"');
    expect(html).toContain('<input type="checkbox" disabled checked />');
    expect(html).toContain('<img src="https://example.com/image.png" alt="Alt"');
  });
});
