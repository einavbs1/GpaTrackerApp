import { type ReactNode } from "react";

/**
 * Index-based on purpose: a regex built from user input would throw on "(" and risks ReDoS.
 */
export function HighlightedText({ text, query }: { text: string; query: string }): ReactNode {
  if (!query) return text;

  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let found = haystack.indexOf(query, cursor);

  while (found !== -1) {
    if (found > cursor) {
      parts.push(text.slice(cursor, found));
    }
    parts.push(
      <mark
        key={`${found}_${parts.length}`}
        className="rounded-md bg-caution-soft px-0.5 text-caution [color-scheme:normal]"
      >
        {text.slice(found, found + query.length)}
      </mark>
    );
    cursor = found + query.length;
    found = haystack.indexOf(query, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}
