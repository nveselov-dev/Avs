"use strict";

/**
 * @module html-lite
 * @description Быстрая совместимая замена части cheerio для kdoc-adapter.
 *
 * Поддерживает ровно тот набор операций, который нужен legacy-логике:
 * - parseHtml(html)
 * - findAll(root, tag)
 * - findDescendants(root, ancestorTag, tag)
 * - attr(node, name)
 * - outerHtml(node)
 * - innerHtml(node)
 * - text(node)
 * - textFromHtml(html)
 * - replacePadding1emWithSpace(html)
 * - pictureTextFromHtml(html)
 * - findSpanByExactStyle(root, styleValue)
 * - findSpansByClass(root, className)
 */

const VOID_TAGS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

const TABLE_CONTEXT_TAGS = new Set([
    "table",
    "tbody",
    "thead",
    "tfoot",
]);

/**
 * Теги, которые по HTML-спецификации неявно закрывают открытый <p>.
 */
const P_CLOSING_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "main",
    "menu",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",

    "tr",
    "td",
    "th",
    "caption",
    "colgroup",

    "li",
    "dt",
    "dd",
]);

const NAMED_ENTITIES = {
    nbsp: "\u00A0",
    ensp: "\u2002",
    emsp: "\u2003",
    thinsp: "\u2009",
    hairsp: "\u200A",

    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",

    ndash: "\u2013",
    mdash: "\u2014",

    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",

    laquo: "\u00AB",
    raquo: "\u00BB",

    sect: "\u00A7",
    copy: "\u00A9",
    reg: "\u00AE",
    trade: "\u2122",

    deg: "\u00B0",
    plusmn: "\u00B1",
    times: "\u00D7",
    divide: "\u00F7",
    micro: "\u00B5",
    middot: "\u00B7",

    hellip: "\u2026",
    bull: "\u2022",
    dagger: "\u2020",
    Dagger: "\u2021",
    prime: "\u2032",
    Prime: "\u2033",

    euro: "\u20AC",
    pound: "\u00A3",
    yen: "\u00A5",
    cent: "\u00A2",

    frac12: "\u00BD",
    frac14: "\u00BC",
    frac34: "\u00BE",
    sup1: "\u00B9",
    sup2: "\u00B2",
    sup3: "\u00B3",

    circ: "\u02C6",
    tilde: "\u02DC",
    grave: "\u0060",
    acute: "\u00B4",
    cedil: "\u00B8",

    Alpha: "\u0391",
    Beta: "\u0392",
    Gamma: "\u0393",
    Delta: "\u0394",
    Epsilon: "\u0395",
    Zeta: "\u0396",
    Eta: "\u0397",
    Theta: "\u0398",
    Iota: "\u0399",
    Kappa: "\u039A",
    Lambda: "\u039B",
    Mu: "\u039C",
    Nu: "\u039D",
    Xi: "\u039E",
    Omicron: "\u039F",
    Pi: "\u03A0",
    Rho: "\u03A1",
    Sigma: "\u03A3",
    Tau: "\u03A4",
    Upsilon: "\u03A5",
    Phi: "\u03A6",
    Chi: "\u03A7",
    Psi: "\u03A8",
    Omega: "\u03A9",

    alpha: "\u03B1",
    beta: "\u03B2",
    gamma: "\u03B3",
    delta: "\u03B4",
    epsilon: "\u03B5",
    zeta: "\u03B6",
    eta: "\u03B7",
    theta: "\u03B8",
    iota: "\u03B9",
    kappa: "\u03BA",
    lambda: "\u03BB",
    mu: "\u03BC",
    nu: "\u03BD",
    xi: "\u03BE",
    omicron: "\u03BF",
    pi: "\u03C0",
    rho: "\u03C1",
    sigma: "\u03C3",
    tau: "\u03C4",
    upsilon: "\u03C5",
    phi: "\u03C6",
    chi: "\u03C7",
    psi: "\u03C8",
    omega: "\u03C9",
};

const ENTITY_RE = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

function isWhitespace(ch) {
    return (
        ch === " " ||
        ch === "\t" ||
        ch === "\n" ||
        ch === "\r" ||
        ch === "\f"
    );
}

function isTagNameStart(ch) {
    return Boolean(ch) && /[a-zA-Z]/.test(ch);
}

function isTagNameChar(ch) {
    return Boolean(ch) && /[\w:-]/.test(ch);
}

function skipWhitespace(html, pos) {
    while (pos < html.length && isWhitespace(html[pos])) {
        pos++;
    }

    return pos;
}

function readTagName(html, pos) {
    const start = pos;

    while (pos < html.length && isTagNameChar(html[pos])) {
        pos++;
    }

    return {
        name: html.slice(start, pos).toLowerCase(),
        end: pos,
    };
}

function findTagEnd(html, start) {
    let quote = null;

    for (let i = start + 1; i < html.length; i++) {
        const ch = html[i];

        if (quote) {
            if (ch === quote) {
                quote = null;
            }

            continue;
        }

        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }

        if (ch === ">") {
            return i + 1;
        }
    }

    return html.length;
}

function parseAttributes(html, pos) {
    const attrs = {};
    let selfClosing = false;

    while (pos < html.length) {
        pos = skipWhitespace(html, pos);

        if (pos >= html.length) {
            break;
        }

        const ch = html[pos];

        if (ch === ">") {
            pos++;
            break;
        }

        if (ch === "/") {
            if (html[pos + 1] === ">") {
                selfClosing = true;
                pos += 2;
                break;
            }

            pos++;
            continue;
        }

        const nameStart = pos;

        while (pos < html.length) {
            const c = html[pos];

            if (
                isWhitespace(c) ||
                c === "=" ||
                c === ">" ||
                c === "/"
            ) {
                break;
            }

            pos++;
        }

        const name = html.slice(nameStart, pos).toLowerCase();

        pos = skipWhitespace(html, pos);

        let value = "";

        if (html[pos] === "=") {
            pos++;
            pos = skipWhitespace(html, pos);

            const quote = html[pos];

            if (quote === '"' || quote === "'") {
                pos++;

                const valueStart = pos;

                while (pos < html.length && html[pos] !== quote) {
                    pos++;
                }

                value = html.slice(valueStart, pos);

                if (pos < html.length) {
                    pos++;
                }
            } else {
                const valueStart = pos;

                while (pos < html.length) {
                    const c = html[pos];

                    if (isWhitespace(c) || c === ">") {
                        break;
                    }

                    if (c === "/" && html[pos + 1] === ">") {
                        break;
                    }

                    pos++;
                }

                value = html.slice(valueStart, pos);
            }
        }

        if (name) {
            attrs[name] = value;
        }
    }

    return {
        attrs,
        selfClosing,
        end: pos,
    };
}

function readOpeningTag(html, pos) {
    const start = pos;
    pos++;

    if (pos >= html.length || !isTagNameStart(html[pos])) {
        return {
            name: "",
            attrs: {},
            selfClosing: false,
            end: findTagEnd(html, start),
        };
    }

    const tag = readTagName(html, pos);
    pos = tag.end;

    const parsed = parseAttributes(html, pos);

    return {
        name: tag.name,
        attrs: parsed.attrs,
        selfClosing: parsed.selfClosing,
        end: parsed.end,
    };
}

/**
 * Нормализует вложенные <a>, как это делает HTML-парсер.
 *
 * По спецификации <a> не может быть вложен в <a>.
 * Поэтому:
 *
 * <a href="1"><a href="2">N 3</a></a>
 *
 * должно превращаться в:
 *
 * <a href="1"></a><a href="2">N 3</a>
 *
 * @param {string} html
 * @returns {string}
 */
function normalizeNestedAnchors(html) {
    html = String(html || "");

    let out = "";
    let i = 0;

    const openAnchors = [];
    let skippedClosingAnchors = 0;

    while (i < html.length) {
        // Комментарий оставляем как есть.
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            const realEnd = end === -1 ? html.length : end + 3;

            out += html.slice(i, realEnd);
            i = realEnd;
            continue;
        }

        // DOCTYPE / processing-like tags оставляем как есть.
        if (html.startsWith("<!", i)) {
            const end = html.indexOf(">", i);
            const realEnd = end === -1 ? html.length : end + 1;

            out += html.slice(i, realEnd);
            i = realEnd;
            continue;
        }

        if (html[i] === "<") {
            // Закрывающий тег.
            if (html[i + 1] === "/") {
                const close = readClosingTag(html, i);
                const tagHtml = html.slice(i, close.end);

                if (close.name === "a") {
                    if (openAnchors.length > 0) {
                        openAnchors.pop();
                        out += tagHtml;
                    } else if (skippedClosingAnchors > 0) {
                        // Это исходный закрывающий </a> для anchor'а,
                        // который мы уже закрыли синтетически.
                        skippedClosingAnchors--;
                    } else {
                        out += tagHtml;
                    }
                } else {
                    out += tagHtml;
                }

                i = close.end;
                continue;
            }

            // Открывающий тег.
            if (isTagNameStart(html[i + 1])) {
                const open = readOpeningTag(html, i);
                const tagHtml = html.slice(i, open.end);

                if (open.name === "a" && !open.selfClosing) {
                    if (openAnchors.length > 0) {
                        // Новый <a> закрывает предыдущий открытый <a>.
                        openAnchors.pop();
                        skippedClosingAnchors++;
                        out += "</a>";
                    }

                    out += tagHtml;
                    openAnchors.push(true);
                } else {
                    out += tagHtml;
                }

                i = open.end;
                continue;
            }

            // Не тег, просто "<".
            out += html[i];
            i++;
            continue;
        }

        // Текст до следующего "<".
        const next = html.indexOf("<", i);

        if (next === -1) {
            out += html.slice(i);
            break;
        }

        out += html.slice(i, next);
        i = next;
    }

    return out;
}

function readClosingTag(html, pos) {
    const start = pos;
    pos++;

    if (html[pos] === "/") {
        pos++;
    }

    if (pos >= html.length || !isTagNameStart(html[pos])) {
        return {
            name: "",
            end: findTagEnd(html, start),
        };
    }

    const tag = readTagName(html, pos);
    pos = tag.end;

    pos = skipWhitespace(html, pos);

    while (pos < html.length && html[pos] !== ">") {
        pos++;
    }

    if (pos < html.length) {
        pos++;
    }

    return {
        name: tag.name,
        end: pos,
    };
}

function findLastTagIndex(stack, tags, fromIndex = stack.length - 1, toIndex = 0) {
    const isSet = tags instanceof Set;

    for (let i = fromIndex; i >= toIndex; i--) {
        const node = stack[i];

        if (!node) {
            continue;
        }

        if (isSet ? tags.has(node.tag) : node.tag === tags) {
            return i;
        }
    }

    return -1;
}

function closeNearest(stack, tag, index, boundary = 0) {
    for (let i = stack.length - 1; i > boundary; i--) {
        if (stack[i].tag === tag) {
            for (let j = stack.length - 1; j >= i; j--) {
                stack[j].innerEnd = index;
                stack[j].end = index;
            }

            stack.length = i;
            return true;
        }
    }

    return false;
}

function closeImpliedTags(stack, openingTag, index) {
    if (openingTag === "a") {
        closeNearest(stack, "a", index, 0);
    }
    const tableContextIndex = findLastTagIndex(stack, TABLE_CONTEXT_TAGS);
    const hasTableContext = tableContextIndex !== -1;
    const tableBoundary = hasTableContext ? tableContextIndex : 0;

    // Блочные теги закрывают открытый <p>.
    if (P_CLOSING_TAGS.has(openingTag)) {
        closeNearest(stack, "p", index, hasTableContext ? tableBoundary : 0);
    }

    // Табличные теги закрываем ТОЛЬКО если есть открытый table/tbody/thead/tfoot.
    if (!hasTableContext) {
        return;
    }

    if (
        openingTag === "tbody" ||
        openingTag === "thead" ||
        openingTag === "tfoot"
    ) {
        closeNearest(stack, "p", index, tableBoundary);
        closeNearest(stack, "td", index, tableBoundary);
        closeNearest(stack, "th", index, tableBoundary);
        closeNearest(stack, "tr", index, tableBoundary);
    }

    if (openingTag === "td" || openingTag === "th") {
        const trIndex = findLastTagIndex(
            stack,
            "tr",
            stack.length - 1,
            tableBoundary + 1
        );

        const cellBoundary = trIndex === -1 ? tableBoundary : trIndex;

        closeNearest(stack, "p", index, cellBoundary);
        closeNearest(stack, "td", index, cellBoundary);
        closeNearest(stack, "th", index, cellBoundary);
    }

    if (openingTag === "tr") {
        closeNearest(stack, "p", index, tableBoundary);
        closeNearest(stack, "td", index, tableBoundary);
        closeNearest(stack, "th", index, tableBoundary);
        closeNearest(stack, "tr", index, tableBoundary);
    }

    if (openingTag === "li") {
        closeNearest(stack, "p", index, 0);
        closeNearest(stack, "li", index, 0);
    }

    if (openingTag === "dt" || openingTag === "dd") {
        closeNearest(stack, "p", index, 0);
        closeNearest(stack, "dt", index, 0);
        closeNearest(stack, "dd", index, 0);
    }
}

function decodeEntities(value) {
    return String(value).replace(ENTITY_RE, (match, entity) => {
        if (entity[0] === "#") {
            const isHex = entity[1] === "x" || entity[1] === "X";
            const code = isHex
                ? parseInt(entity.slice(2), 16)
                : parseInt(entity.slice(1), 10);

            if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
                try {
                    return String.fromCodePoint(code);
                } catch (_) {
                    return match;
                }
            }

            return match;
        }

        const named = NAMED_ENTITIES[entity.toLowerCase()];
        return named === undefined ? match : named;
    });
}

function normalizeVoidClosings(html) {
    return String(html).replace(
        /<\/(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\s*>/gi,
        ""
    );
}

function encodeNonBreakingSpaces(html) {
    return String(html).replace(/\u00A0/g, "&nbsp;");
}

function serializeHtmlFragment(html) {
    return encodeNonBreakingSpaces(
        normalizeNestedAnchors(normalizeVoidClosings(html))
    );
}

function parseHtml(html) {
    html = String(html || "");

    const root = {
        type: "root",
        tag: "#root",
        attrs: {},
        children: [],
        parent: null,
        start: 0,
        end: html.length,
        innerStart: 0,
        innerEnd: html.length,
        html,
        root: null,
        selfClosing: false,
        _explicitClose: true,
    };

    root.root = root;

    const stack = [root];

    let i = 0;

    while (i < html.length) {
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            i = end === -1 ? html.length : end + 3;
            continue;
        }

        if (html.startsWith("<!", i)) {
            const end = html.indexOf(">", i);
            i = end === -1 ? html.length : end + 1;
            continue;
        }

        if (html[i] === "<") {
            if (html[i + 1] === "/") {
                const closeStart = i;
                const close = readClosingTag(html, i);

                if (close.name) {
                    let openIndex = -1;

                    for (let j = stack.length - 1; j > 0; j--) {
                        if (stack[j].tag === close.name) {
                            openIndex = j;
                            break;
                        }
                    }

                    if (openIndex !== -1) {
                        for (let j = stack.length - 1; j > openIndex; j--) {
                            stack[j].innerEnd = closeStart;
                            stack[j].end = closeStart;
                        }

                        stack[openIndex].innerEnd = closeStart;
                        stack[openIndex].end = close.end;
                        stack[openIndex]._explicitClose = true;

                        stack.length = openIndex;
                    }
                }

                i = close.end;
                continue;
            }

            if (isTagNameStart(html[i + 1])) {
                const tagStart = i;
                const open = readOpeningTag(html, i);

                if (!open.name) {
                    i = open.end;
                    continue;
                }

                closeImpliedTags(stack, open.name, tagStart);

                const parent = stack[stack.length - 1];

                const node = {
                    type: "element",
                    tag: open.name,
                    attrs: open.attrs,
                    children: [],
                    parent,
                    start: tagStart,
                    end: -1,
                    innerStart: open.end,
                    innerEnd: -1,
                    html,
                    root,
                    selfClosing: open.selfClosing || VOID_TAGS.has(open.name),
                    _explicitClose: false,
                };

                parent.children.push(node);

                if (node.selfClosing) {
                    node.end = open.end;
                    node.innerStart = open.end;
                    node.innerEnd = open.end;
                    node._explicitClose = true;
                } else {
                    stack.push(node);
                }

                i = open.end;
                continue;
            }

            i++;
            continue;
        }

        const next = html.indexOf("<", i);
        i = next === -1 ? html.length : next;
    }

    for (let j = stack.length - 1; j > 0; j--) {
        stack[j].innerEnd = html.length;
        stack[j].end = html.length;
    }

    root.end = html.length;

    return root;
}

function traverse(node, fn) {
    if (!node || !node.children) {
        return;
    }

    for (const child of node.children) {
        fn(child);
        traverse(child, fn);
    }
}

function findAll(root, tag) {
    const result = [];

    traverse(root, (node) => {
        if (node.tag === tag) {
            result.push(node);
        }
    });

    return result;
}

function hasAncestor(node, ancestorTag) {
    let current = node.parent;

    while (current && current.tag !== "#root") {
        if (current.tag === ancestorTag) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

function findDescendants(root, ancestorTag, tag) {
    const ancestors = findAll(root, ancestorTag);
    const result = [];
    const seen = new Set();

    for (const ancestor of ancestors) {
        const nodes = findAll(ancestor, tag);

        for (const node of nodes) {
            if (!seen.has(node)) {
                seen.add(node);
                result.push(node);
            }
        }
    }

    result.sort((a, b) => a.start - b.start);

    return result;
}

function attr(node, name) {
    if (!node || !node.attrs) {
        return undefined;
    }

    return node.attrs[name];
}

function outerHtml(node) {
    if (!node) {
        return "";
    }

    const html = node.html || (node.root && node.root.html) || "";

    if (!html) {
        return "";
    }

    let result = serializeHtmlFragment(html.slice(node.start, node.end));

    if (
        node.type === "element" &&
        node.tag !== "#root" &&
        !VOID_TAGS.has(node.tag) &&
        !node.selfClosing &&
        !node._explicitClose
    ) {
        result += `</${node.tag}>`;
    }

    return result;
}

function innerHtml(node) {
    if (!node) {
        return "";
    }

    const html = node.html || (node.root && node.root.html) || "";

    if (!html) {
        return "";
    }

    if (node.tag === "#root") {
        return serializeHtmlFragment(html);
    }

    return serializeHtmlFragment(html.slice(node.innerStart, node.innerEnd));
}

function textFromHtml(html) {
    html = String(html || "");

    let out = "";
    let i = 0;

    while (i < html.length) {
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            i = end === -1 ? html.length : end + 3;
            continue;
        }

        if (html[i] === "<") {
            i = findTagEnd(html, i);
            continue;
        }

        const next = html.indexOf("<", i);
        const chunk = next === -1 ? html.slice(i) : html.slice(i, next);

        out += decodeEntities(chunk);

        i = next === -1 ? html.length : next;
    }

    return out;
}

function text(node) {
    return textFromHtml(innerHtml(node));
}

function isSpanWithPadding1em(tag) {
    if (!/^<span\b/i.test(tag)) {
        return false;
    }

    const end = tag.endsWith("/>") ? -2 : -1;
    const attrPart = tag.slice(5, end);

    try {
        const parsed = parseAttributes(`<span${attrPart}>`, 5);
        return parsed.attrs.style === "padding-left:1em;";
    } catch (_) {
        return false;
    }
}

function findMatchingCloseEnd(html, from, tagName) {
    let depth = 1;
    let i = from;

    while (i < html.length) {
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            i = end === -1 ? html.length : end + 3;
            continue;
        }

        if (html[i] === "<") {
            if (html[i + 1] === "/") {
                const close = readClosingTag(html, i);

                if (close.name === tagName) {
                    depth--;

                    if (depth === 0) {
                        return close.end;
                    }
                }

                i = close.end;
                continue;
            }

            if (isTagNameStart(html[i + 1])) {
                const open = readOpeningTag(html, i);

                if (
                    open.name === tagName &&
                    !open.selfClosing &&
                    !VOID_TAGS.has(open.name)
                ) {
                    depth++;
                }

                i = open.end;
                continue;
            }

            i++;
            continue;
        }

        i++;
    }

    return html.length;
}

function replacePadding1emWithSpace(html) {
    html = String(html || "");

    let out = "";
    let i = 0;

    while (i < html.length) {
        if (html.startsWith("<!--", i)) {
            const end = html.indexOf("-->", i + 4);
            const realEnd = end === -1 ? html.length : end + 3;

            out += html.slice(i, realEnd);
            i = realEnd;
            continue;
        }

        if (html[i] === "<") {
            if (html[i + 1] === "/") {
                const tagEnd = findTagEnd(html, i);
                out += html.slice(i, tagEnd);
                i = tagEnd;
                continue;
            }

            if (isTagNameStart(html[i + 1])) {
                const tagEnd = findTagEnd(html, i);
                const tag = html.slice(i, tagEnd);

                if (isSpanWithPadding1em(tag)) {
                    if (tag.endsWith("/>")) {
                        out += " ";
                        i = tagEnd;
                        continue;
                    }

                    const closeEnd = findMatchingCloseEnd(html, tagEnd, "span");

                    out += " ";
                    i = closeEnd;
                    continue;
                }

                out += tag;
                i = tagEnd;
                continue;
            }

            out += html[i];
            i++;
            continue;
        }

        const next = html.indexOf("<", i);

        if (next === -1) {
            out += html.slice(i);
            break;
        }

        out += html.slice(i, next);
        i = next;
    }

    return out;
}

function pictureTextFromHtml(html) {
    return String(html || "")
        .replace(/<span style="padding-left:1em;">/g, (str) => ` ${str}`)
        .replace(/<(?!\/?(picture|img)\b)[^>]*>/g, "")
        .replace(/&nbsp;/g, " ");
}

function findSpanByExactStyle(root, styleValue) {
    let found = null;

    traverse(root, (node) => {
        if (found) {
            return;
        }

        if (
            node.tag === "span" &&
            node.attrs &&
            node.attrs.style === styleValue
        ) {
            found = node;
        }
    });

    return found;
}

function getClassList(node) {
    const classValue = node.attrs && node.attrs.class;

    if (!classValue) {
        return [];
    }

    return String(classValue)
        .split(/\s+/)
        .filter(Boolean);
}

function findSpansByClass(root, className) {
    const result = [];

    traverse(root, (node) => {
        if (node.tag === "span" && getClassList(node).includes(className)) {
            result.push(node);
        }
    });

    return result;
}

function firstElementText(root, tag) {
    const elements = findAll(root, tag);
    return elements.length ? text(elements[0]).trim() : "";
}

module.exports = {
    parseHtml,
    findAll,
    findDescendants,
    attr,
    outerHtml,
    innerHtml,
    textFromHtml,
    text,
    replacePadding1emWithSpace,
    pictureTextFromHtml,
    findSpanByExactStyle,
    findSpansByClass,
    firstElementText,
};