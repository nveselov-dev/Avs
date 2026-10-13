const {
  isBoldFull,
  isBoldStart,
  isItalicText,
  getTextFormat,
} = require("./text-format-utils");

const {
  outerHtml,
  innerHtml,
  attr,
  text,
  textFromHtml,
  replacePadding1emWithSpace,
  pictureTextFromHtml,
  findSpanByExactStyle,
} = require("../html-lite");

const docType = require("../../constants").DOC_TYPE;

const pictureRegExp =
    /<picture\s+class="[^>]+"><img\s+src="data:image\/png;base64,[^>]+"\s+style="[^>]+"><\/picture>/;

/**
 * Создаёт объект-параграф.
 *
 * @param {*} _$ больше не нужен, оставлен для совместимости вызова
 * @param {object} $element DOM-нода <p>
 * @param {object} stylesData стили
 * @returns {object} PObject
 */
module.exports = (_$, $element, stylesData) => {
  const source = outerHtml($element);
  const inner = innerHtml($element);

  // Эмуляция:
  // const $e = cheerio.load($element.html());
  // $e('span[style="padding-left:1em;"]').each(... replaceWith(" "));
  // text: $e.text()
  const textAfterPadding1em = textFromHtml(
      replacePadding1emWithSpace(inner)
  );

  // Эмуляция:
  // const spanElement = $('span[style="padding-left:5em;"]', $element);
  const spanElement = findSpanByExactStyle(
      $element,
      "padding-left:5em;"
  );

  const styleAttributeValue = spanElement
      ? attr(spanElement, "style")
      : null;

  const paddingValue = styleAttributeValue
      ? styleAttributeValue.match(/padding-left:(\d+)em;/)
      : null;

  const spacesBefore = paddingValue ? parseInt(paddingValue[1]) : 0;

  const className = attr($element, "class");
  const styleClass = stylesData[className];

  // Для format оригинал использует $element.text(), НЕ $e.text()
  const elementText = text($element);

  const isBold =
      textAfterPadding1em.trim() &&
      ((styleClass && styleClass["font-weight"] == "bold") ||
          isBoldFull(source, stylesData));

  const isItalic =
      textAfterPadding1em.trim() &&
      ((styleClass && styleClass["font-style"] == "italic") ||
          isItalicText(source, stylesData));

  const format = getTextFormat(styleClass, elementText, isBold);

  const PObject = {
    type: "P",
    source,
    pid: attr($element, "data-pid"),
    spacesBefore,
    text: textAfterPadding1em,
    format,
    align: styleClass ? styleClass["text-align"] : undefined,
    isBold,
    isItalic,
    isBoldBegin: isBoldStart(source, stylesData),
    docType,
  };

  if (pictureRegExp.test(PObject.source.trim())) {
    PObject.text = pictureTextFromHtml(PObject.source);
  }

  return PObject;
};