const {
  getTextFormat,
} = require("./text-format-utils");

const {
  attr,
  getParagraphStats,
  pictureTextFromHtml,
} = require("../html-lite");

const docType = require("../../constants").DOC_TYPE;

/**
 * Создаёт объект-параграф.
 *
 * @param {*} _$ больше не нужен, оставлен для совместимости вызова
 * @param {object} $element DOM-нода <p>
 * @param {object} stylesData стили
 * @returns {object} PObject
 */
module.exports = (_$, $element, stylesData) => {
  const stats = getParagraphStats($element, stylesData);

  const className = attr($element, "class");
  const styleClass = stylesData[className];

  const textForChecks = stats.textAfterPadding1em;

  const isBold =
      textForChecks.trim() &&
      ((styleClass && styleClass["font-weight"] == "bold") ||
          stats.boldFull);

  const isItalic =
      textForChecks.trim() &&
      ((styleClass && styleClass["font-style"] == "italic") ||
          stats.italicFull);

  const format = getTextFormat(styleClass, stats.originalText, isBold);

  const PObject = {
    type: "P",
    source: stats.source,
    pid: attr($element, "data-pid"),
    spacesBefore: stats.hasPaddingLeft5em ? 5 : 0,
    text: textForChecks,
    format,
    align: styleClass ? styleClass["text-align"] : undefined,
    isBold,
    isItalic,
    isBoldBegin: stats.boldStart,
    docType,
  };

  if (stats.hasPicture) {
    PObject.text = pictureTextFromHtml(PObject.source);
  }

  return PObject;
};