/**
 * Minimal, safe Markdown renderer for assistant replies.
 *
 * Deliberately not a general Markdown library: it handles exactly the subset
 * the assistant produces (bold, italic, inline code, links, numbered and
 * bulleted lists) and renders to React elements. Because nothing is ever
 * assigned via dangerouslySetInnerHTML, model output cannot inject markup.
 */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

/** Renders bold / italic / code / links inside a single line of text. */
function renderInline(text, keyPrefix) {
  const nodes = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const [, label, href] = token.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {label}
        </a>
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const ORDERED_ITEM = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*•]\s+(.*)$/;

/**
 * Renders Markdown text to an array of React elements.
 * Consecutive list items are grouped into a single <ol>/<ul>.
 */
export function renderMarkdown(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];

  let list = null; // { type: "ol" | "ul", items: string[] }
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(<p key={key}>{renderInline(paragraph.join(" "), key)}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const key = `l-${blocks.length}`;
    const Tag = list.type;
    blocks.push(
      <Tag key={key}>
        {list.items.map((item, i) => (
          <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const ordered = line.match(ORDERED_ITEM);
    const bullet = line.match(BULLET_ITEM);

    if (ordered || bullet) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      const content = ordered ? ordered[2] : bullet[1];

      // A change of list type starts a new list rather than mixing markers.
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };

      list.items.push(content);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return blocks;
}
