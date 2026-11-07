const {
  parseHtml,
  findAll,
  getParagraphStats,
} = require("../html-lite");

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
 * Совместимая обёртка для старого API.
 * Основной код теперь должен использовать getParagraphStats().
 */
function isBoldFull(htmlString, stylesData) {
  const root = parseHtml(htmlString);
  const paragraph = findAll(root, "p")[0];

  if (!paragraph) {
    return false;
  }

  const stats = getParagraphStats(paragraph, stylesData);
  return Boolean(stats && stats.boldFull);
}

/**
 * Совместимая обёртка для старого API.
 */
function isItalicText(htmlString, stylesData) {
  const root = parseHtml(htmlString);
  const paragraph = findAll(root, "p")[0];

  if (!paragraph) {
    return false;
  }

  const stats = getParagraphStats(paragraph, stylesData);
  return Boolean(stats && stats.italicFull);
}

/**
 * Совместимая обёртка для старого API.
 */
function isBoldStart(htmlString, stylesData) {
  const root = parseHtml(htmlString);
  const paragraph = findAll(root, "p")[0];

  if (!paragraph) {
    return false;
  }

  const stats = getParagraphStats(paragraph, stylesData);
  return Boolean(stats && stats.boldStart);
}

exports.getTextFormat = getTextFormat;
exports.isBoldStart = isBoldStart;
exports.isBoldFull = isBoldFull;
exports.isItalicText = isItalicText;