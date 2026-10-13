const {
  isBoldFull,
  isItalicText,
  getTextFormat,
} = require("../text-utils/text-format-utils");

const {
  outerHtml,
  innerHtml,
  attr,
  text,
  findDescendants,
} = require("../html-lite");

const kdocHtmlRegExp =
    /<picture\s+class="[^>]+"><img\s+src="data:image\/png;base64,[^>]+"\s+style="[^>]+"><\/picture>/;

/**
 * Текст для ячеек с картинками, как в оригинальном fill-by-rows.js.
 *
 * @param {string} html inner HTML ячейки.
 * @returns {string}
 */
function pictureTextFromInnerHtml(html) {
  return String(html || "")
      .replace(
          /<span style="padding-left:1em;">/g,
          (str) => ` ${str}`
      )
      .replace(/<(?!\/?(picture|img)\b)[^>]*>/g, "")
      .replace(/&nbsp;/g, " ");
}

/**
 * Заполняет поле "rows" у табличного объекта адаптера.
 *
 * @param {object} tableObject табличный объект из адаптера.
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ Заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @returns {void}
 */
module.exports = (tableObject, rows, _$, stylesData) => {
  tableObject.type = "ROWS";
  tableObject.rows = [];

  rows.forEach((row) => {
    let rowText = "";
    const cells = [];

    let firstPid = "";
    let lastPid = "";

    const cellElements = findDescendants(row, "td", "p");

    cellElements.forEach((cell) => {
      const source = outerHtml(cell);
      const inner = innerHtml(cell);

      // Оригинальный $(cell).text()
      const cellTextOriginal = text(cell);

      let cellText = "";

      if (kdocHtmlRegExp.test(inner.trim())) {
        cellText = pictureTextFromInnerHtml(inner);
      }

      if (!cellText) {
        cellText = cellTextOriginal;
      }

      rowText += ` ${cellText}`;

      const className = attr(cell, "class");
      const styleClass = stylesData[className];

      const isBold =
          cellTextOriginal.trim() &&
          ((styleClass && styleClass["font-weight"] == "bold") ||
              isBoldFull(source, stylesData));

      const isItalic =
          cellTextOriginal.trim() &&
          ((styleClass && styleClass["font-style"] == "italic") ||
              isItalicText(source, stylesData));

      const format = getTextFormat(
          styleClass,
          cellTextOriginal,
          isBold
      );

      const cellObject = {
        type: "P",
        source: inner,
        pid: attr(cell, "data-pid"),
        spacesBefore: 0,
        text: cellText,
        format,
        align: styleClass ? styleClass["text-align"] : undefined,
        isBold,
        isItalic,
      };

      if (!firstPid && cellObject.pid) {
        firstPid = cellObject.pid;
      }

      if (cellObject.pid) {
        lastPid = cellObject.pid;
      }

      cells.push(cellObject);
    });

    tableObject.rows.push({
      type: "ROW",
      source: innerHtml(row),
      text: rowText,
      cells,
      firstPid,
      lastPid,
    });
  });
};