const isHorizontalLinesOnly = require("./is-only-horisontal");

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
  textFromHtml,
  replacePadding1emWithSpace,
  findDescendants,
} = require("../html-lite");

/**
 * Заполняет табличный объект адаптера.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @param {object} tableObject табличный объект из адаптера.
 * @returns {void}
 */
module.exports = (rows, _$, stylesData, tableObject) => {
  rows.forEach((rowElement) => {
    const cellElements = findDescendants(rowElement, "td", "p");

    cellElements.forEach((cellElement) => {
      const className = attr(cellElement, "class");
      const styleClass = stylesData[className];

      const source = outerHtml(cellElement);
      const inner = innerHtml(cellElement);

      // Оригинальный $cellElement.text()
      const cellTextOriginal = text(cellElement);

      // Оригинальный cheerio.load($cellElement.html())
      // + замена span[style="padding-left:1em;"] на пробел
      // + $e.text()
      const cellTextAfterPadding1em = textFromHtml(
          replacePadding1emWithSpace(inner)
      );

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
        source,
        pid: attr(cellElement, "data-pid"),
        spacesBefore: 0,
        text: cellTextAfterPadding1em,
        format,
        align: styleClass ? styleClass["text-align"] : undefined,
        isBold,
        isItalic,
      };

      tableObject.cells.push(cellObject);

      if (cellObject.pid) {
        tableObject.lastPid = cellObject.pid;
      }
    });
  });

  tableObject.isDoubleLine = isHorizontalLinesOnly(
      rows,
      _$,
      stylesData
  );

  const firstCellWithPid = tableObject.cells.find((obj) => obj.pid);

  tableObject.firstPid = firstCellWithPid
      ? firstCellWithPid.pid
      : null;
};