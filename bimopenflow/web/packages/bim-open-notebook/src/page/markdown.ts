// A small, safe markdown renderer for reply text: a model or a committed
// sample file, never trusted as HTML. Parses a safe subset (paragraphs,
// bold, italic, inline code, fenced code blocks, bullet and numbered lists
// with one level of nesting, headings # to ###, and http(s) links) into a
// token tree, then builds DOM nodes from the tokens with createElement and
// textContent. Nothing here calls innerHTML or any HTML parser, so anything
// outside the subset — a stray `<script>`, an unrecognised construct, a
// `javascript:` link — passes through as literal text, never markup.

interface ParagraphBlock {
  readonly kind: "paragraph";
  readonly text: string;
}

interface HeadingBlock {
  readonly kind: "heading";
  readonly level: 1 | 2 | 3;
  readonly text: string;
}

interface CodeBlock {
  readonly kind: "code";
  readonly lang?: string;
  readonly code: string;
}

interface ListItem {
  readonly text: string;
  readonly sub?: ListBlock;
}

interface ListBlock {
  readonly kind: "list";
  readonly ordered: boolean;
  readonly items: ListItem[];
}

type Block = ParagraphBlock | HeadingBlock | CodeBlock | ListBlock;

const FENCE_RE = /^```(\S*)\s*$/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

/** Splits reply text into block-level tokens: paragraphs, headings, fenced
 * code, and lists (with nested sub-lists by indent). */
function parseBlocks(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume the closing fence
      blocks.push({ kind: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i++;
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const { list, next } = parseList(lines, i);
      blocks.push(list);
      i = next;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !FENCE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !LIST_ITEM_RE.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join("\n") });
  }
  return blocks;
}

/** Parses one list starting at `start`: items at the first line's indent,
 * and one level of nested items at a deeper indent, collected under the
 * previous item at the shallower level. */
function parseList(lines: readonly string[], start: number): { list: ListBlock; next: number } {
  const first = lines[start].match(LIST_ITEM_RE)!;
  const baseIndent = first[1].length;
  const ordered = /^\d+\./.test(first[2]);
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM_RE);
    if (!m) break;
    const indent = m[1].length;
    if (indent < baseIndent) break;
    if (indent === baseIndent) {
      items.push({ text: m[3] });
      i++;
      continue;
    }
    // Deeper indent: a nested list under the previous item.
    const nestedStart = i;
    let j = i;
    while (j < lines.length) {
      const nm = lines[j].match(LIST_ITEM_RE);
      if (!nm || nm[1].length <= baseIndent) break;
      j++;
    }
    const { list: nested } = parseList(lines.slice(nestedStart, j), 0);
    if (items.length > 0) {
      items[items.length - 1] = { ...items[items.length - 1], sub: nested };
    }
    i = j;
  }
  return { list: { kind: "list", ordered, items }, next: i };
}

interface TextInline {
  readonly kind: "text";
  readonly text: string;
}
interface CodeInline {
  readonly kind: "code";
  readonly text: string;
}
interface BoldInline {
  readonly kind: "bold";
  readonly children: Inline[];
}
interface ItalicInline {
  readonly kind: "italic";
  readonly children: Inline[];
}
interface LinkInline {
  readonly kind: "link";
  readonly href: string;
  readonly children: Inline[];
}
type Inline = TextInline | CodeInline | BoldInline | ItalicInline | LinkInline;

const INLINE_CODE_RE = /^`([^`]+)`/;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)/;
const BOLD_RE = /^\*\*(.+?)\*\*/;
const ITALIC_STAR_RE = /^\*([^*\n]+)\*/;
// CommonMark: underscore emphasis opens and closes only at word boundaries,
// so snake_case_names stay literal. The closing check is in the pattern; the
// opening check (no letter or digit before) is in parseInline.
const ITALIC_UNDERSCORE_RE = /^_([^_\n]+)_(?![\p{L}\p{N}])/u;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const HTTP_URL_RE = /^https?:\/\//i;

/** Parses inline markdown (bold, italic, code, links) within one block's
 * text. Anything that does not match a known construct — including an
 * angle-bracket tag or a non-http(s) link — is emitted as literal text. */
function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let buf = "";
  const flush = (): void => {
    if (buf) {
      nodes.push({ kind: "text", text: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpMatchArray | null;

    if ((m = rest.match(INLINE_CODE_RE))) {
      flush();
      nodes.push({ kind: "code", text: m[1] });
      i += m[0].length;
      continue;
    }

    if ((m = rest.match(LINK_RE)) && HTTP_URL_RE.test(m[2])) {
      flush();
      nodes.push({ kind: "link", href: m[2], children: parseInline(m[1]) });
      i += m[0].length;
      continue;
    }

    if ((m = rest.match(BOLD_RE))) {
      flush();
      nodes.push({ kind: "bold", children: parseInline(m[1]) });
      i += m[0].length;
      continue;
    }

    if ((m = rest.match(ITALIC_STAR_RE)) || (!(i > 0 && WORD_CHAR_RE.test(text[i - 1])) && (m = rest.match(ITALIC_UNDERSCORE_RE)))) {
      flush();
      nodes.push({ kind: "italic", children: parseInline(m[1]) });
      i += m[0].length;
      continue;
    }

    buf += text[i];
    i++;
  }
  flush();
  return nodes;
}

function buildInline(doc: Document, node: Inline): Node {
  switch (node.kind) {
    case "text":
      return doc.createTextNode(node.text);
    case "code": {
      const el = doc.createElement("code");
      el.textContent = node.text;
      return el;
    }
    case "bold": {
      const el = doc.createElement("strong");
      appendInline(doc, el, node.children);
      return el;
    }
    case "italic": {
      const el = doc.createElement("em");
      appendInline(doc, el, node.children);
      return el;
    }
    case "link": {
      const el = doc.createElement("a");
      el.href = node.href;
      el.target = "_blank";
      el.rel = "noopener";
      appendInline(doc, el, node.children);
      return el;
    }
  }
}

function appendInline(doc: Document, parent: HTMLElement, nodes: readonly Inline[]): void {
  for (const node of nodes) parent.appendChild(buildInline(doc, node));
}

function buildListItem(doc: Document, item: ListItem): HTMLElement {
  const li = doc.createElement("li");
  appendInline(doc, li, parseInline(item.text));
  if (item.sub) li.appendChild(buildBlock(doc, item.sub));
  return li;
}

function buildBlock(doc: Document, block: Block): HTMLElement {
  switch (block.kind) {
    case "paragraph": {
      const p = doc.createElement("p");
      appendInline(doc, p, parseInline(block.text));
      return p;
    }
    case "heading": {
      const el = doc.createElement(`h${block.level}`) as HTMLElement;
      el.className = "nb-md-heading";
      appendInline(doc, el, parseInline(block.text));
      return el;
    }
    case "code": {
      const pre = doc.createElement("pre");
      const code = doc.createElement("code");
      code.textContent = block.code;
      if (block.lang) code.className = `language-${block.lang}`;
      pre.appendChild(code);
      return pre;
    }
    case "list": {
      const list = doc.createElement(block.ordered ? "ol" : "ul");
      for (const item of block.items) list.appendChild(buildListItem(doc, item));
      return list;
    }
  }
}

/** Renders `text` as a safe subset of markdown, appending one element per
 * block to `container`. Builds every node from `doc.createElement` and
 * `textContent`; never assigns to `innerHTML` and never parses HTML. */
export function renderMarkdown(doc: Document, container: HTMLElement, text: string): void {
  for (const block of parseBlocks(text.split("\n"))) {
    container.appendChild(buildBlock(doc, block));
  }
}
