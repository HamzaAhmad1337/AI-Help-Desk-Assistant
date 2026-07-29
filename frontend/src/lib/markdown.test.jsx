import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown.jsx";

/** Flattens rendered React elements to a comparable plain structure. */
function flatten(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.props?.children);
}

const text = (blocks) => blocks.map(flatten).join("\n");
const types = (blocks) => blocks.map((b) => b.type);

describe("renderMarkdown", () => {
  it("renders a plain paragraph", () => {
    const blocks = renderMarkdown("Just restart it.");
    expect(types(blocks)).toEqual(["p"]);
    expect(text(blocks)).toBe("Just restart it.");
  });

  it("joins wrapped lines into one paragraph", () => {
    const blocks = renderMarkdown("first line\nsecond line");
    expect(blocks).toHaveLength(1);
    expect(text(blocks)).toBe("first line second line");
  });

  it("splits paragraphs on a blank line", () => {
    expect(types(renderMarkdown("one\n\ntwo"))).toEqual(["p", "p"]);
  });

  it("groups consecutive numbered items into a single list", () => {
    const blocks = renderMarkdown("1. First\n2. Second\n3. Third");
    expect(types(blocks)).toEqual(["ol"]);
    expect(blocks[0].props.children).toHaveLength(3);
  });

  it("supports both . and ) numbering", () => {
    expect(types(renderMarkdown("1) One\n2) Two"))).toEqual(["ol"]);
  });

  it("renders bulleted lists", () => {
    const blocks = renderMarkdown("- one\n- two");
    expect(types(blocks)).toEqual(["ul"]);
  });

  it("starts a new list when the marker type changes", () => {
    expect(types(renderMarkdown("1. one\n- two"))).toEqual(["ol", "ul"]);
  });

  it("keeps a paragraph and a following list separate", () => {
    expect(types(renderMarkdown("Try this:\n1. Restart"))).toEqual(["p", "ol"]);
  });

  it("renders bold, italic and inline code", () => {
    const blocks = renderMarkdown("Click **Save**, then *maybe* run `npm test`.");
    const kinds = blocks[0].props.children.filter((c) => typeof c === "object").map((c) => c.type);
    expect(kinds).toEqual(["strong", "em", "code"]);
    expect(text(blocks)).toBe("Click Save, then maybe run npm test.");
  });

  it("renders __bold__ as well as **bold**", () => {
    const blocks = renderMarkdown("__Save__");
    expect(blocks[0].props.children[0].type).toBe("strong");
  });

  it("renders safe links with hardened rel attributes", () => {
    const blocks = renderMarkdown("See [the docs](https://example.com/help).");
    const link = blocks[0].props.children.find((c) => c?.type === "a");
    expect(link.props.href).toBe("https://example.com/help");
    expect(link.props.rel).toContain("noopener");
    expect(link.props.target).toBe("_blank");
  });

  it("refuses to linkify javascript: urls", () => {
    const blocks = renderMarkdown("[click](javascript:alert(1))");
    const hasLink = blocks[0].props.children.some((c) => c?.type === "a");
    expect(hasLink).toBe(false);
    expect(text(blocks)).toContain("javascript:alert(1)");
  });

  it("never emits raw html for injected markup", () => {
    const blocks = renderMarkdown('<img src=x onerror="alert(1)">');
    // The tags survive as literal text, never as elements.
    expect(types(blocks)).toEqual(["p"]);
    expect(text(blocks)).toContain("<img");
  });

  it("renders headings without emitting real heading tags", () => {
    const blocks = renderMarkdown("### Next steps\nRestart.");
    expect(types(blocks)).toEqual(["div", "p"]);
    expect(flatten(blocks[0])).toBe("Next steps");
  });

  it("applies inline formatting inside list items", () => {
    const blocks = renderMarkdown("1. Press **Save**");
    const item = blocks[0].props.children[0];
    expect(flatten(item)).toBe("Press Save");
  });

  it("handles empty and nullish input", () => {
    expect(renderMarkdown("")).toEqual([]);
    expect(renderMarkdown(null)).toEqual([]);
    expect(renderMarkdown(undefined)).toEqual([]);
  });

  it("leaves an unterminated bold marker as literal text while streaming", () => {
    expect(text(renderMarkdown("Click **Sav"))).toBe("Click **Sav");
  });

  it("produces unique keys for sibling blocks", () => {
    const blocks = renderMarkdown("one\n\ntwo\n\nthree");
    const keys = blocks.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
