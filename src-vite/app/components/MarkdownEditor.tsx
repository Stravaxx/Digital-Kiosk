import React from 'react';
import { PenSquare, X } from 'lucide-react';
import { markdownToHtml } from '../../services/markdownService';
import { GlassButton } from './GlassButton';
import { GlassCard } from './GlassCard';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  popupOnly?: boolean;
  popupTitle?: string;
}

function wrapSelection(input: HTMLTextAreaElement, before: string, after: string = before): { next: string; start: number; end: number } {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const selected = input.value.slice(start, end);
  const next = `${input.value.slice(0, start)}${before}${selected}${after}${input.value.slice(end)}`;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, start: cursorStart, end: cursorEnd };
}

function MarkdownToolbar({
  applyToken
}: {
  applyToken: (before: string, after?: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('# ')}>H1</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('## ')}>H2</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('**')}>Gras</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('*')}>Italique</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('- [ ] ')}>Checklist</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('| Col A | Col B |\n| --- | --- |\n| 1 | 2 |')}>Table</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('`')}>Code</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('[texte](', ')')}>Lien</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('![alt](', ')')}>Image</GlassButton>
      <GlassButton size="sm" variant="ghost" onClick={() => applyToken('> ')}>Citation</GlassButton>
    </div>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  popupOnly = false,
  popupTitle = 'Éditeur Markdown'
}: MarkdownEditorProps) {
  const inlineTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const popupTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [popupOpen, setPopupOpen] = React.useState(false);

  const html = React.useMemo(() => markdownToHtml(value), [value]);

  const applyTokenFrom = (target: 'inline' | 'popup', before: string, after?: string) => {
    const textarea = target === 'popup' ? popupTextareaRef.current : inlineTextareaRef.current;
    if (!textarea) return;

    const { next, start, end } = wrapSelection(textarea, before, after);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  };

  const editorBody = (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <textarea
        ref={popupOpen ? popupTextareaRef : inlineTextareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
        placeholder="Saisissez votre contenu Markdown..."
      />
      <div className="rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[#e5e7eb] markdown-content overflow-auto max-h-[380px]">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );

  if (popupOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[#9ca3af] text-sm">Éditer le texte Markdown dans une popup dédiée.</p>
          <GlassButton size="sm" variant="ghost" onClick={() => setPopupOpen(true)}>
            <PenSquare size={14} className="mr-1" />
            Ouvrir éditeur
          </GlassButton>
        </div>

        <div className="rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-3 text-[#9ca3af] text-sm max-h-[100px] overflow-auto">
          {value.trim() ? value : 'Aucun contenu Markdown pour le moment.'}
        </div>

        {popupOpen ? (
          <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-6xl p-4 space-y-3 max-h-[92vh] overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-[#e5e7eb] text-lg">{popupTitle}</h3>
                <button
                  type="button"
                  onClick={() => setPopupOpen(false)}
                  className="text-[#9ca3af] hover:text-[#e5e7eb]"
                  aria-label="Fermer l'éditeur markdown"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              <MarkdownToolbar applyToken={(before, after) => applyTokenFrom('popup', before, after)} />
              <div className="overflow-auto">{editorBody}</div>

              <div className="flex justify-end">
                <GlassButton onClick={() => setPopupOpen(false)}>Fermer</GlassButton>
              </div>
            </GlassCard>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <MarkdownToolbar applyToken={(before, after) => applyTokenFrom('inline', before, after)} />
        <GlassButton size="sm" variant="ghost" onClick={() => setPopupOpen(true)}>
          <PenSquare size={14} className="mr-1" />
          Popup
        </GlassButton>
      </div>

      {editorBody}

      {popupOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-6xl p-4 space-y-3 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-[#e5e7eb] text-lg">{popupTitle}</h3>
              <button
                type="button"
                onClick={() => setPopupOpen(false)}
                className="text-[#9ca3af] hover:text-[#e5e7eb]"
                aria-label="Fermer l'éditeur markdown"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <MarkdownToolbar applyToken={(before, after) => applyTokenFrom('popup', before, after)} />
            <div className="overflow-auto">{editorBody}</div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
