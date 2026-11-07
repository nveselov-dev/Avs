"use strict";

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
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    ensp: "\u2002",
    emsp: "\u2003",
    thinsp: "\u2009",
    ndash: "\u2013",
    mdash: "\u2014",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",
    laquo: "\u00AB",
    raquo: "\u00BB",
    hellip: "\u2026",
    bull: "\u2022",
    middot: "\u00B7",
    copy: "\u00A9",
    reg: "\u00AE",
    trade: "\u2122",
    deg: "\u00B0",
    plusmn: "\u00B1",
    times: "\u00D7",
    divide: "\u00F7",
    micro: "\u00B5",
    euro: "\u20AC",
    pound: "\u00A3",
    yen: "\u00A5",
    cent: "\u00A2",
    sect: "\u00A7",
    dagger: "\u2020",
    Dagger: "\u2021",
    prime: "\u2032",
    Prime: "\u2033",
    frac12: "\u00BD",
    frac14: "\u00BC",
    frac34: "\u00BE",
    sup1: "\u00B9",
    sup2: "\u00B2",
    sup3: "\u00B3",
    circ: "\u02C6",
    tilde: "\u02DC",
    grave: "`",
    acute: "\u00B4",
    cedil: "\u00B8",
    AMP: "&",
    LT: "<",
    GT: ">",
    QUOT: '"',
    COPY: "\u00A9",
    REG: "\u00AE",
};

const ENTITY_RE = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

const PICTURE_REGEXP =
    /<picture\s+class="[^>]+"><img\s+src="data:image\/png;base64,[^>]+"\s+style="[^>]+"><\/picture>/;

const BORDER_FLAGS_CACHE = new WeakMap();

const EMPTY_BORDER_FLAGS = Object.freeze({
    left: false,
    right: false,
    top: false,
    bottom: false,
});

const STYLE_META_CACHE = new WeakMap();

function isWhitespace(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
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
    const len = html.length;
    let i = start + 1;

    while (i < len) {
        const code = html.charCodeAt(i);

        if (code === 62) {
            return i + 1;
        }

        if (code === 34) {
            const close = html.indexOf('"', i + 1);

            if (close === -1) {
                return len;
            }

            i = close + 1;
            continue;
        }

        if (code === 39) {
            const close = html.indexOf("'", i + 1);

            if (close === -1) {
                return len;
            }

            i = close + 1;
            continue;
        }

        i++;
    }

    return len;
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

            if (isWhitespace(c) || c === "=" || c === ">" || c === "/") {
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

        const named = NAMED_ENTITIES[entity];
        return named === undefined ? match : named;
    });
}

function isAsciiLetterCode(code) {
    return (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122)   // a-z
    );
}

/**
 * Возвращает true, если позиция i указывает на начало реальной разметки:
 * <tag, </tag, <!--, <!doctype, <?pi.
 *
 * Одиночный < в тексте вида "2 < 3" разметкой не считается.
 */
function isMarkupStart(html, i) {
    if (i < 0 || i >= html.length) {
        return false;
    }

    if (html.charCodeAt(i) !== 60) {
        return false;
    }

    const next = html.charCodeAt(i + 1);

    if (Number.isNaN(next)) {
        return false;
    }

    // </tag
    if (next === 47) {
        const afterSlash = html.charCodeAt(i + 2);
        return isAsciiLetterCode(afterSlash);
    }

    // <!comment, <!DOCTYPE, <![CDATA[
    if (next === 33) {
        return true;
    }

    // <?processing-instruction
    if (next === 63) {
        return true;
    }

    // <tag
    return isAsciiLetterCode(next);
}

function findNextMarkupStart(html, from) {
    let i = html.indexOf("<", from);

    while (i !== -1) {
        if (isMarkupStart(html, i)) {
            return i;
        }

        i = html.indexOf("<", i + 1);
    }

    return -1;
}

function findMarkupEnd(html, start) {
    const len = html.length;

    if (html.startsWith("<!--", start)) {
        const end = html.indexOf("-->", start + 4);
        return end === -1 ? len : end + 3;
    }

    if (html.startsWith("<![CDATA[", start)) {
        const end = html.indexOf("]]>", start + 9);
        return end === -1 ? len : end + 3;
    }

    const second = html.charCodeAt(start + 1);

    if (second === 33 || second === 63) {
        const end = html.indexOf(">", start + 2);
        return end === -1 ? len : end + 1;
    }

    return findTagEnd(html, start);
}

function getBorderFlags(style) {
    if (!style || typeof style !== "object") {
        return EMPTY_BORDER_FLAGS;
    }

    let flags = BORDER_FLAGS_CACHE.get(style);

    if (!flags) {
        flags = {
            left: /solid/.test(style["border-left"] || ""),
            right: /solid/.test(style["border-right"] || ""),
            top: /solid/.test(style["border-top"] || ""),
            bottom: /solid/.test(style["border-bottom"] || ""),
        };

        BORDER_FLAGS_CACHE.set(style, flags);
    }

    return flags;
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

function normalizeNestedAnchors(html) {
    html = String(html || "");

    const len = html.length;

    let out = "";
    let i = 0;

    const openAnchors = [];
    let skippedClosingAnchors = 0;

    while (i < len) {
        const next = findNextMarkupStart(html, i);

        if (next === -1) {
            out += html.slice(i);
            break;
        }

        if (next > i) {
            out += html.slice(i, next);
        }

        i = next;

        // Комментарии, CDATA, doctype, PI оставляем как есть.
        if (
            html.startsWith("<!--", i) ||
            html.startsWith("<![CDATA[", i)
        ) {
            const end = findMarkupEnd(html, i);
            out += html.slice(i, end);
            i = end;
            continue;
        }

        const second = html.charCodeAt(i + 1);

        if (second === 33 || second === 63) {
            const end = findMarkupEnd(html, i);
            out += html.slice(i, end);
            i = end;
            continue;
        }

        // Closing tag.
        if (second === 47) {
            const close = readClosingTag(html, i);
            const tagHtml = html.slice(i, close.end);

            if (close.name === "a") {
                if (openAnchors.length > 0) {
                    openAnchors.pop();
                    out += tagHtml;
                } else if (skippedClosingAnchors > 0) {
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

        // Opening tag.
        const open = readOpeningTag(html, i);
        const tagHtml = html.slice(i, open.end);

        if (open.name === "a" && !open.selfClosing) {
            if (openAnchors.length > 0) {
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
    }

    return out;
}

function prepareHtml(html) {
    html = String(html || "");

    html = normalizeVoidClosings(html);
    html = normalizeNestedAnchors(html);
    html = encodeNonBreakingSpaces(html);

    return html;
}

function serializeHtmlFragment(html) {
    return html;
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

    if (P_CLOSING_TAGS.has(openingTag)) {
        closeNearest(stack, "p", index, hasTableContext ? tableBoundary : 0);
    }

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

function parseHtml(html) {
    html = String(html || "");

    const len = html.length;

    const root = {
        type: "root",
        tag: "#root",
        attrs: {},
        children: [],
        parent: null,
        start: 0,
        end: len,
        innerStart: 0,
        innerEnd: len,
        html,
        root: null,
        selfClosing: false,
        _explicitClose: true,
    };

    root.root = root;

    const stack = [root];

    let i = 0;

    while (i < len) {
        if (html.charCodeAt(i) === 60 && isMarkupStart(html, i)) {
            // Comment.
            if (html.startsWith("<!--", i)) {
                const end = html.indexOf("-->", i + 4);
                i = end === -1 ? len : end + 3;
                continue;
            }

            // CDATA.
            if (html.startsWith("<![CDATA[", i)) {
                const end = html.indexOf("]]>", i + 9);
                i = end === -1 ? len : end + 3;
                continue;
            }

            const second = html.charCodeAt(i + 1);

            // Doctype / processing instruction.
            if (second === 33 || second === 63) {
                const end = html.indexOf(">", i + 2);
                i = end === -1 ? len : end + 1;
                continue;
            }

            // Closing tag.
            if (second === 47) {
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

            // Opening tag.
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

        // Text node до следующей реальной разметки.
        const next = findNextMarkupStart(html, i);
        const end = next === -1 ? len : next;

        if (end > i) {
            const parent = stack[stack.length - 1];

            parent.children.push({
                type: "text",
                value: html.slice(i, end),
                start: i,
                end,
                parent,
                root,
                html,
            });
        }

        i = end;
    }

    for (let j = stack.length - 1; j > 0; j--) {
        stack[j].innerEnd = len;
        stack[j].end = len;
    }

    root.end = len;

    indexTree(root);

    return root;
}

function traverseElements(node, fn) {
    if (!node) {
        return;
    }

    if (node.type === "element") {
        fn(node);
    }

    if (node.children) {
        for (const child of node.children) {
            traverseElements(child, fn);
        }
    }
}

function isSkipLink(node) {
    if (!node || node.type !== "element" || node.tag !== "a") {
        return false;
    }

    if (node._skipLink !== undefined) {
        return node._skipLink;
    }

    const html = node.html || (node.root && node.root.html) || "";

    if (!html) {
        node._skipLink = false;
        return false;
    }

    const openTag = html.slice(node.start, node.innerStart);
    const result = /<a\s+href=[^>]+>/i.test(openTag);

    node._skipLink = result;
    return result;
}

function isSkipPicture(node) {
    if (!node || node.type !== "element" || node.tag !== "picture") {
        return false;
    }

    if (node._skipPicture !== undefined) {
        return node._skipPicture;
    }

    const result = PICTURE_REGEXP.test(outerHtml(node));

    node._skipPicture = result;
    return result;
}

function isSkipNode(node) {
    return isSkipLink(node) || isSkipPicture(node);
}

function indexTree(root) {
    root._all = {
        p: [],
        table: [],
    };

    const tableStack = [];
    const rowStack = [];
    const cellStack = [];
    const paragraphStack = [];

    function visit(node, skipped) {
        if (!node || (node.type !== "element" && node.type !== "root")) {
            return;
        }

        const skipSelf = node.type === "element" ? isSkipNode(node) : false;
        const childSkipped = skipped || skipSelf;

        if (node.type === "element") {
            if (node.tag === "table") {
                root._all.table.push(node);
                node._trs = [];
                node._tds = [];
                tableStack.push(node);
            }

            if (node.tag === "tr") {
                for (const table of tableStack) {
                    table._trs.push(node);
                }

                node._tds = [];
                rowStack.push(node);
            }

            if (node.tag === "td" || node.tag === "th") {
                for (const table of tableStack) {
                    table._tds.push(node);
                }

                for (const row of rowStack) {
                    row._tds.push(node);
                }

                node._ps = [];
                cellStack.push(node);
            }

            if (node.tag === "p") {
                root._all.p.push(node);

                for (const cell of cellStack) {
                    cell._ps.push(node);
                }

                node._spans = [];
                paragraphStack.push(node);
            }

            if (node.tag === "span") {
                node._skipped = skipped;

                for (const paragraph of paragraphStack) {
                    paragraph._spans.push(node);
                }
            }
        }

        if (node.children) {
            for (const child of node.children) {
                visit(child, childSkipped);
            }
        }

        if (node.type === "element") {
            if (node.tag === "p") {
                paragraphStack.pop();
            }

            if (node.tag === "td" || node.tag === "th") {
                cellStack.pop();
            }

            if (node.tag === "tr") {
                rowStack.pop();
            }

            if (node.tag === "table") {
                tableStack.pop();
            }
        }
    }

    visit(root, false);
}

function findAll(root, tag) {
    if (!root) {
        return [];
    }

    if (root._all && root._all[tag]) {
        return root._all[tag];
    }

    if (tag === "td" && root._tds) {
        return root._tds;
    }

    if (tag === "tr" && root._trs) {
        return root._trs;
    }

    if (tag === "p" && root._ps) {
        return root._ps;
    }

    if (tag === "span" && root._spans) {
        return root._spans;
    }

    if (!root._findAllCache) {
        root._findAllCache = new Map();
    }

    const cached = root._findAllCache.get(tag);

    if (cached) {
        return cached;
    }

    const result = [];

    traverseElements(root, (node) => {
        if (node.tag === tag) {
            result.push(node);
        }
    });

    root._findAllCache.set(tag, result);
    return result;
}

function findDescendants(root, ancestorTag, tag) {
    if (!root) {
        return [];
    }

    const key = `${ancestorTag}::${tag}`;

    if (!root._findDescendantsCache) {
        root._findDescendantsCache = new Map();
    }

    const cached = root._findDescendantsCache.get(key);

    if (cached) {
        return cached;
    }

    const ancestors = findAll(root, ancestorTag);
    const result = [];
    const seen = new Set();

    for (const ancestor of ancestors) {
        const nodes =
            ancestorTag === "td" && tag === "p" && ancestor._ps
                ? ancestor._ps
                : findAll(ancestor, tag);

        for (const node of nodes) {
            if (!seen.has(node)) {
                seen.add(node);
                result.push(node);
            }
        }
    }

    result.sort((a, b) => a.start - b.start);

    root._findDescendantsCache.set(key, result);
    return result;
}

function attr(node, name) {
    if (!node || !node.attrs) {
        return undefined;
    }

    return node.attrs[name];
}

function getClassList(node) {
    if (!node) {
        return [];
    }

    if (node._classList) {
        return node._classList;
    }

    const classValue = node.attrs && node.attrs.class;

    if (!classValue) {
        node._classList = [];
        return node._classList;
    }

    node._classList = String(classValue)
        .split(/\s+/)
        .filter(Boolean);

    return node._classList;
}

function outerHtml(node) {
    if (!node) {
        return "";
    }

    if (node.type === "text") {
        return node.value;
    }

    if (node._outerHtml !== undefined) {
        return node._outerHtml;
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

    node._outerHtml = result;
    return result;
}

function innerHtml(node) {
    if (!node) {
        return "";
    }

    if (node.type === "text") {
        return node.value;
    }

    if (node._innerHtml !== undefined) {
        return node._innerHtml;
    }

    const html = node.html || (node.root && node.root.html) || "";

    if (!html) {
        return "";
    }

    let result;

    if (node.tag === "#root") {
        result = serializeHtmlFragment(html);
    } else {
        result = serializeHtmlFragment(html.slice(node.innerStart, node.innerEnd));
    }

    node._innerHtml = result;
    return result;
}


function collectTextAll(node, out) {
    if (!node) {
        return;
    }

    if (node.type === "text") {
        out.push(decodeEntities(node.value));
        return;
    }

    if (node.children) {
        for (const child of node.children) {
            collectTextAll(child, out);
        }
    }
}

function text(node) {
    if (!node) {
        return "";
    }

    if (node._text !== undefined) {
        return node._text;
    }

    const out = [];
    collectTextAll(node, out);
    const result = out.join("");

    node._text = result;
    return result;
}

function collectTextPadding1em(node, out) {
    if (!node) {
        return;
    }

    if (node.type === "text") {
        out.push(decodeEntities(node.value));
        return;
    }

    if (
        node.tag === "span" &&
        node.attrs &&
        node.attrs.style === "padding-left:1em;"
    ) {
        out.push(" ");
        return;
    }

    if (node.children) {
        for (const child of node.children) {
            collectTextPadding1em(child, out);
        }
    }
}

function textAfterPadding1em(node) {
    if (!node) {
        return "";
    }

    if (node._textAfterPadding1em !== undefined) {
        return node._textAfterPadding1em;
    }

    const out = [];
    collectTextPadding1em(node, out);
    const result = out.join("");

    node._textAfterPadding1em = result;
    return result;
}

function collectTextOutside(node, out) {
    if (!node) {
        return;
    }

    if (node.type === "text") {
        out.push(decodeEntities(node.value));
        return;
    }

    if (isSkipNode(node)) {
        return;
    }

    if (node.children) {
        for (const child of node.children) {
            collectTextOutside(child, out);
        }
    }
}

function textOutside(node) {
    if (!node) {
        return "";
    }

    if (node._textOutside !== undefined) {
        return node._textOutside;
    }

    const out = [];
    collectTextOutside(node, out);
    const result = out.join("");

    node._textOutside = result;
    return result;
}

function collectParagraphTexts(node) {
    if (!node) {
        return {
            original: "",
            padded: "",
            outside: "",
            hasPaddingLeft5em: false,
        };
    }

    if (node._paragraphTexts) {
        return node._paragraphTexts;
    }

    const originalParts = [];
    const paddedParts = [];
    const outsideParts = [];
    let hasPaddingLeft5em = false;

    function visit(n, skipped, insidePadding1em) {
        if (!n) {
            return;
        }

        if (n.type === "text") {
            const decoded = decodeEntities(n.value);

            originalParts.push(decoded);

            if (!insidePadding1em) {
                paddedParts.push(decoded);
            }

            if (!skipped) {
                outsideParts.push(decoded);
            }

            return;
        }

        if (n.type !== "element") {
            return;
        }

        const nodeSkipped = skipped || isSkipNode(n);

        if (n.tag === "span") {
            const style = n.attrs && n.attrs.style;

            if (style === "padding-left:5em;") {
                hasPaddingLeft5em = true;
            }

            if (style === "padding-left:1em;") {
                if (!insidePadding1em) {
                    paddedParts.push(" ");
                }

                if (n.children) {
                    for (const child of n.children) {
                        visit(child, nodeSkipped, true);
                    }
                }

                return;
            }
        }

        if (n.children) {
            for (const child of n.children) {
                visit(child, nodeSkipped, insidePadding1em);
            }
        }
    }

    visit(node, false, false);

    const result = {
        original: originalParts.join(""),
        padded: paddedParts.join(""),
        outside: outsideParts.join(""),
        hasPaddingLeft5em,
    };

    node._paragraphTexts = result;
    return result;
}

function getStyleMeta(stylesData) {
    let meta = STYLE_META_CACHE.get(stylesData);

    if (meta) {
        return meta;
    }

    const classOrder = Object.keys(stylesData || {});

    const boldClasses = classOrder.filter(
        (classKey) => stylesData[classKey]["font-weight"] === "bold"
    );

    const italicClasses = classOrder.filter(
        (classKey) => stylesData[classKey]["font-style"] === "italic"
    );

    meta = {
        classOrder,
        boldClasses,
        italicClasses,
        boldSet: new Set(boldClasses),
        italicSet: new Set(italicClasses),
    };

    STYLE_META_CACHE.set(stylesData, meta);
    return meta;
}

function collectSpansFallback(node) {
    const result = [];

    traverseElements(node, (child) => {
        if (child.tag === "span") {
            result.push(child);
        }
    });

    return result;
}

function isSpanSkipped(span) {
    if (span._skipped !== undefined) {
        return span._skipped;
    }

    let current = span.parent;

    while (current && current.tag !== "#root") {
        if (isSkipNode(current)) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

function processSpanForStats(span, skipped, ctx) {
    const classList = getClassList(span);

    const textAll = text(span).trim();

    if (textAll) {
        for (const classKey of classList) {
            if (ctx.boldSet.has(classKey) && !ctx.firstBold.has(classKey)) {
                ctx.firstBold.set(classKey, textAll);
            }
        }
    }

    if (!skipped) {
        const textOut = textOutside(span).trim();

        if (textOut) {
            for (const classKey of classList) {
                if (ctx.boldSet.has(classKey)) {
                    ctx.boldMap.set(
                        classKey,
                        (ctx.boldMap.get(classKey) || "") + textOut
                    );
                }

                if (ctx.italicSet.has(classKey)) {
                    ctx.italicMap.set(
                        classKey,
                        (ctx.italicMap.get(classKey) || "") + textOut
                    );
                }
            }
        }
    }
}

function getParagraphStats(node, stylesData) {
    if (!node) {
        return null;
    }

    if (node._stats && node._statsStyles === stylesData) {
        return node._stats;
    }

    const meta = getStyleMeta(stylesData);

    const source = outerHtml(node);
    const inner = innerHtml(node);

    const texts = collectParagraphTexts(node);

    const originalText = texts.original;
    const paddedText = texts.padded;

    const fullTextOutside = texts.outside.trim();
    const denominator = fullTextOutside.replace(/\s+/g, "").length;

    const ctx = {
        boldSet: meta.boldSet,
        italicSet: meta.italicSet,
        boldMap: new Map(),
        italicMap: new Map(),
        firstBold: new Map(),
        hasPaddingLeft5em: texts.hasPaddingLeft5em,
    };

    const spans = node._spans || collectSpansFallback(node);

    for (const span of spans) {
        processSpanForStats(span, isSpanSkipped(span), ctx);
    }

    let boldFull = false;

    if (denominator) {
        let cumulative = "";

        for (const classKey of meta.boldClasses) {
            cumulative += ctx.boldMap.get(classKey) || "";

            const numerator = cumulative.trim().replace(/\s+/g, "").length;

            if (numerator / denominator > 0.95) {
                boldFull = true;
                break;
            }
        }

        if (!boldFull) {
            const numerator = cumulative.trim().replace(/\s+/g, "").length;
            boldFull = numerator / denominator > 0.85;
        }
    }

    let italicFull = false;

    if (denominator) {
        let italicText = "";

        for (const classKey of meta.italicClasses) {
            italicText += ctx.italicMap.get(classKey) || "";
        }

        const numerator = italicText.trim().replace(/\s+/g, "").length;
        italicFull = numerator / denominator > 0.9;
    }

    let boldStart = false;

    const fullStartText = originalText.trim();

    if (fullStartText) {
        for (const classKey of meta.boldClasses) {
            const first = ctx.firstBold.get(classKey);

            if (first && fullStartText.startsWith(first)) {
                boldStart = true;
                break;
            }
        }
    }

    const hasPicture = PICTURE_REGEXP.test(source.trim());

    const stats = {
        source,
        inner,
        originalText,
        textAfterPadding1em: paddedText,
        hasPaddingLeft5em: ctx.hasPaddingLeft5em,
        hasPicture,
        boldFull,
        italicFull,
        boldStart,
    };

    node._stats = stats;
    node._statsStyles = stylesData;

    return stats;
}

function pictureTextFromHtml(html) {
    return String(html || "")
        .replace(/<span style="padding-left:1em;">/g, (str) => ` ${str}`)
        .replace(/<(?!\/?(picture|img)\b)[^>]*>/g, "")
        .replace(/&nbsp;/g, " ");
}

module.exports = {
    parseHtml,
    prepareHtml,
    findAll,
    findDescendants,
    attr,
    innerHtml,
    text,
    textAfterPadding1em,
    getParagraphStats,
    pictureTextFromHtml,
    getBorderFlags,
};