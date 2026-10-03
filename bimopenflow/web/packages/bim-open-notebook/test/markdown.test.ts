import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/page/markdown";

function render(text: string): HTMLElement {
  const container = document.createElement("div");
  renderMarkdown(document, container, text);
  return container;
}

describe("renderMarkdown: paragraphs", () => {
  it("splits blank-line-separated text into paragraphs", () => {
    const el = render("First paragraph.\n\nSecond paragraph.");
    const paragraphs = el.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("First paragraph.");
    expect(paragraphs[1].textContent).toBe("Second paragraph.");
  });

  it("plain text with no markdown constructs round-trips through textContent", () => {
    const el = render("Nothing special here.");
    expect(el.querySelector("p")?.textContent).toBe("Nothing special here.");
  });
});

describe("renderMarkdown: inline constructs", () => {
  it("renders **bold** as <strong>", () => {
    const el = render("This has **78 analyses** in it.");
    const strong = el.querySelector("strong");
    expect(strong?.textContent).toBe("78 analyses");
    expect(strong?.parentElement?.tagName).toBe("P");
  });

  it("leaves underscores inside words literal and italicises _x_ at word boundaries", () => {
    const abc = render("a_b_c and OperationalCarbon_kgCO2e_per_year");
    expect(abc.querySelector("em")).toBeNull();
    expect(abc.textContent).toBe("a_b_c and OperationalCarbon_kgCO2e_per_year");
    expect(render("see _italic_, then (_more_).").querySelectorAll("em").length).toBe(2);
  });

  it("renders *italic* and _italic_ as <em>", () => {
    const star = render("An *italic* word.").querySelector("em");
    expect(star?.textContent).toBe("italic");
    const underscore = render("An _italic_ word.").querySelector("em");
    expect(underscore?.textContent).toBe("italic");
  });

  it("renders `code` as <code>", () => {
    const el = render("Run `nrc-q1-building-total` now.");
    const code = el.querySelector("code");
    expect(code?.textContent).toBe("nrc-q1-building-total");
  });

  it("renders [text](https://...) as a safe link", () => {
    const el = render("See [the docs](https://example.com/docs) for more.");
    const link = el.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/docs");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener");
    expect(link?.textContent).toBe("the docs");
  });
});

describe("renderMarkdown: fenced code blocks", () => {
  it("renders a fenced block as <pre><code>, preserving lines", () => {
    const el = render("Before.\n\n```sql\nselect 1;\nselect 2;\n```\n\nAfter.");
    const pre = el.querySelector("pre");
    const code = pre?.querySelector("code");
    expect(code?.textContent).toBe("select 1;\nselect 2;");
    expect(code?.className).toBe("language-sql");
    expect(el.querySelectorAll("p")).toHaveLength(2);
  });

  it("supports a fenced block with no language", () => {
    const el = render("```\nplain\n```");
    const code = el.querySelector("pre code");
    expect(code?.textContent).toBe("plain");
    expect(code?.className).toBe("");
  });
});

describe("renderMarkdown: lists", () => {
  it("renders bullet lines as a <ul>", () => {
    const el = render("- first\n- second\n- third");
    const ul = el.querySelector("ul");
    expect(ul).toBeTruthy();
    const items = ul?.querySelectorAll(":scope > li") ?? [];
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("first");
    expect(items[2].textContent).toBe("third");
  });

  it("renders numbered lines as an <ol>", () => {
    const el = render("1. first\n2. second");
    const ol = el.querySelector("ol");
    expect(ol).toBeTruthy();
    expect(ol?.querySelectorAll("li")).toHaveLength(2);
  });

  it("nests an indented list under the previous item, one level deep", () => {
    const el = render("- outer one\n  - inner a\n  - inner b\n- outer two");
    const outer = el.querySelector("ul");
    const outerItems = outer?.querySelectorAll(":scope > li") ?? [];
    expect(outerItems).toHaveLength(2);
    const nested = outerItems[0].querySelector("ul");
    expect(nested?.querySelectorAll("li")).toHaveLength(2);
    expect(nested?.querySelectorAll("li")[0].textContent).toBe("inner a");
  });
});

describe("renderMarkdown: headings", () => {
  it("renders # through ### as heading elements with a small-heading class", () => {
    const el = render("# One\n\n## Two\n\n### Three");
    expect(el.querySelector("h1.nb-md-heading")?.textContent).toBe("One");
    expect(el.querySelector("h2.nb-md-heading")?.textContent).toBe("Two");
    expect(el.querySelector("h3.nb-md-heading")?.textContent).toBe("Three");
  });
});

describe("renderMarkdown: safety", () => {
  it("a <script> tag in the text stays literal, never parsed as an element", () => {
    const el = render("Careful: <script>alert(1)</script> stays text.");
    expect(el.querySelector("script")).toBeNull();
    expect(el.textContent).toContain("<script>alert(1)</script>");
  });

  it("a javascript: link stays literal text, not an anchor", () => {
    const el = render("Do not click [here](javascript:alert(1)).");
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("[here](javascript:alert(1))");
  });

  it("never touches innerHTML: the container's own markup is never source text", () => {
    const el = render("<div class=\"nb-injected\">not real</div>");
    expect(el.querySelector(".nb-injected")).toBeNull();
    expect(el.textContent).toContain('<div class="nb-injected">not real</div>');
  });
});

describe("renderMarkdown: committed sample", () => {
  it("renders a reply with backticked identifiers as <code>, matching the committed sample text", () => {
    const text =
      "`elements` reads `nrc_analytics_elements.csv` from the `nrc` source, 218 rows.";
    const el = render(text);
    const codes = Array.from(el.querySelectorAll("code")).map((c) => c.textContent);
    expect(codes).toEqual(["elements", "nrc_analytics_elements.csv", "nrc"]);
  });
});
