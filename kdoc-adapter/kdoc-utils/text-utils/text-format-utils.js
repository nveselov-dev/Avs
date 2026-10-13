const {
  parseHtml,
  findAll,
  text,
  findSpansByClass,
} = require("../html-lite");

const boldClassesCache = new WeakMap();
const italicClassesCache = new WeakMap();

function getBoldClasses(stylesData) {
  let cached = boldClassesCache.get(stylesData);

  if (cached) return cached;

  cached = Object.keys(stylesData).filter(
      (classKey) => stylesData[classKey]["font-weight"] === "bold"
  );

  boldClassesCache.set(stylesData, cached);
  return cached;
}

function getItalicClasses(stylesData) {
  let cached = italicClassesCache.get(stylesData);

  if (cached) return cached;

  cached = Object.keys(stylesData).filter(
      (classKey) => stylesData[classKey]["font-style"] === "italic"
  );

  italicClassesCache.set(stylesData, cached);
  return cached;
}

/**
 * Определяет формат текста элемента.
 *
 * ВАЖНО:
 * - styleClass ищется без точки
 * - format считается по исходному тексту элемента
 * - ветка с <img src=...> оставлена как в оригинале
 */
function getTextFormat(styleClass, elementText, isBold) {
  let format;

  if (!styleClass) return "unformattext";

  const trimmed = String(elementText || "").trim();

  if (
      trimmed &&
      !trimmed.match(/\.$/) &&
      (isBold ||
          (styleClass["font-size"] &&
              styleClass["font-size"].replace(/pt/, "") >= 16))
  ) {
    format = "headertext";
  } else if (trimmed.match(/<img src=[^>]>/)) {
    format = "";
  } else {
    format = "formattext";
  }

  return format;
}

/**
 * Проверяет, начинается ли HTML-строка с жирного текста.
 */
function isBoldStart(htmlString, stylesData) {
  const root = parseHtml(htmlString);
  const paragraph = findAll(root, "p")[0];
  const fullText = paragraph ? text(paragraph).trim() : "";

  const boldClasses = getBoldClasses(stylesData);

  for (const classKey of boldClasses) {
    const spans = findSpansByClass(root, classKey);

    let boldText = "";

    for (const span of spans) {
      const textInside = text(span).trim();

      if (textInside !== "" && !boldText) {
        boldText = textInside;
        break;
      }
    }

    if (boldText && fullText.startsWith(boldText)) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет, является ли HTML-строка жирным текстом.
 */
function isBoldFull(htmlString, stylesData) {
  const spanMatches = htmlString.match(/<\/span>/g);
  const numOfSpans = spanMatches ? spanMatches.length : 0;

  let clearString = htmlString;
  let oldString = htmlString;

  for (let i = 0; i < numOfSpans; i++) {
    clearString = clearString.replace(/<span[^>]*?><\/span>/g, "");

    if (clearString == oldString) break;

    oldString = clearString;
  }

  const pictureRegExp =
      /<picture\s+class="[^>]+"><img\s+src="data:image\/png;base64,[^>]+"\s+style="[^>]+"><\/picture>/g;

  clearString = clearString
      .replace(/<a href=[^>]+>[\s\S]*?<\/a>/g, "")
      .replace(pictureRegExp, "");

  const root = parseHtml(clearString);
  const paragraph = findAll(root, "p")[0];
  const fullText = paragraph ? text(paragraph).trim() : "";

  if (!fullText.replace(/\s+/g, "")) return false;

  let boldText = "";

  const boldClasses = getBoldClasses(stylesData);

  for (const classKey of boldClasses) {
    const spans = findSpansByClass(root, classKey);

    for (const span of spans) {
      const textInside = text(span).trim();

      if (textInside !== "") {
        boldText += textInside;
      }
    }

    const boldCoef =
        boldText.trim().replace(/\s+/g, "").length /
        fullText.replace(/\s+/g, "").length;

    if (boldCoef > 0.95) {
      return true;
    }
  }

  const boldCoef =
      boldText.trim().replace(/\s+/g, "").length /
      fullText.replace(/\s+/g, "").length;

  return boldCoef > 0.85;
}

/**
 * Проверяет, является ли HTML-строка курсивным текстом.
 */
function isItalicText(htmlString, stylesData) {
  const spanMatches = htmlString.match(/<\/span>/g);
  const numOfSpans = spanMatches ? spanMatches.length : 0;

  let clearString = htmlString;
  let oldString = htmlString;

  for (let i = 0; i < numOfSpans; i++) {
    clearString = clearString.replace(/<span[^>]*?><\/span>/g, "");

    if (clearString == oldString) break;

    oldString = clearString;
  }

  const pictureRegExp =
      /<picture\s+class="[^>]+"><img\s+src="data:image\/png;base64,[^>]+"\s+style="[^>]+"><\/picture>/g;

  clearString = clearString
      .replace(/<a href=[^>]+>[\s\S]*?<\/a>/g, "")
      .replace(pictureRegExp, "");

  const root = parseHtml(clearString);
  const paragraph = findAll(root, "p")[0];
  const fullText = paragraph ? text(paragraph).trim() : "";

  if (!fullText.replace(/\s+/g, "")) return false;

  let italicText = "";

  const italicClasses = getItalicClasses(stylesData);

  for (const classKey of italicClasses) {
    const spans = findSpansByClass(root, classKey);

    for (const span of spans) {
      const textInside = text(span).trim();

      if (textInside !== "") {
        italicText += textInside;
      }
    }
  }

  const italicCoef =
      italicText.trim().replace(/\s+/g, "").length /
      fullText.replace(/\s+/g, "").length;

  return italicCoef > 0.9;
}

exports.getTextFormat = getTextFormat;
exports.isBoldStart = isBoldStart;
exports.isBoldFull = isBoldFull;
exports.isItalicText = isItalicText;