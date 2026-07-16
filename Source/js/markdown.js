export function escapeHtml(value) {
  const text = String(value ?? "");

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInline(text) {
  const codeSpans = [];

  let output = text.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(escapeHtml(code));
    return token;
  });

  output = escapeHtml(output);

  output = output.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/\r?\n/g, "<br>");

  return output.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${codeSpans[Number(index)] ?? ""}</code>`);
}

export function renderMarkdown(markdown) {
  if (!markdown) return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;
  let quoteLines = [];
  let codeLines = [];
  let codeLang = "";
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push(`<p>${formatInline(paragraphLines.join(" ").trim())}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const tag = listType === "ol" ? "ol" : "ul";
    blocks.push(`<${tag}>${listItems.map((item) => `<li>${formatInline(item)}</li>`).join("")}</${tag}>`);
    listItems = [];
    listType = null;
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    const content = quoteLines.map((line) => formatInline(line)).join("<br>");
    blocks.push(`<blockquote>${content}</blockquote>`);
    quoteLines = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    blocks.push(`<pre class="md-code-block"><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    codeLang = "";
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushCode();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inCode) {
      if (/^```/.test(line.trim())) {
        inCode = false;
        flushCode();
      } else {
        codeLines.push(rawLine);
      }
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    const fenceMatch = trimmed.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      flushAll();
      inCode = true;
      codeLang = fenceMatch[1] || "";
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${formatInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      listType = listType || "ul";
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      listType = listType || "ol";
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraphLines.push(trimmed);
  }

  flushAll();

  return blocks.join("");
}
