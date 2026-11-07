const isHorizontalLinesOnly = require("./is-only-horisontal");

const {
  getTextFormat,
} = require("../text-utils/text-format-utils");

const {
  attr,
  findDescendants,
  getParagraphStats,
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

      const stats = getParagraphStats(cellElement, stylesData);

      const cellTextOriginal = stats.originalText;
      const cellTextAfterPadding1em = stats.textAfterPadding1em;

      const isBold =
          cellTextOriginal.trim() &&
          ((styleClass && styleClass["font-weight"] == "bold") ||
              stats.boldFull);

      const isItalic =
          cellTextOriginal.trim() &&
          ((styleClass && styleClass["font-style"] == "italic") ||
              stats.italicFull);

      const format = getTextFormat(
          styleClass,
          cellTextOriginal,
          isBold
      );

      const cellObject = {
        type: "P",
        source: stats.source,
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