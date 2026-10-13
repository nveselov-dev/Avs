const { attr, findAll } = require("../html-lite");

/**
 * Проверяет, что таблица является просто элементами в рамке.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ Заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @returns {boolean} true, если таблица является рамкой с объектами.
 */
module.exports = (rows, _$, stylesData) => {
  let isSingleFrame = true;

  const rowCount = rows.length;

  rows.forEach((rowElement, rowIndex) => {
    const colCount = findAll(rowElement, "td").length;

    findAll(rowElement, "td").forEach((cellElement, cellIndex) => {
      if (!isSingleFrame) {
        return;
      }

      const className = attr(cellElement, "class");
      const styleClass = stylesData[className] || {};

      const left = /solid/.test(styleClass["border-left"]);
      const right = /solid/.test(styleClass["border-right"]);
      const top = /solid/.test(styleClass["border-top"]);
      const bottom = /solid/.test(styleClass["border-bottom"]);

      const isTopRow = rowIndex == 0;
      const isBottomRow = rowIndex == rowCount - 1;
      const isFirstCol = cellIndex == 0;
      const isLastCol = cellIndex == colCount - 1;

      if (isTopRow) {
        if (isFirstCol) {
          if (left && top && !right && !bottom) {
            return;
          }

          if (isLastCol && left && top && right && !bottom) {
            return;
          }
        }

        if (isLastCol) {
          if (!left && top && right && !bottom) {
            return;
          }
        } else {
          if (top) {
            return;
          }
        }
      } else if (isBottomRow) {
        if (isFirstCol) {
          if (left && !top && !right && bottom) {
            return;
          }

          if (isLastCol && left && !top && right && bottom) {
            return;
          }
        }

        if (isLastCol) {
          if (!left && !top && right && bottom) {
            return;
          }
        } else {
          if (bottom) {
            return;
          }
        }
      } else {
        if (isFirstCol) {
          if (left && !top && !bottom) {
            return;
          }

          if (isLastCol && left && !top && right && !bottom) {
            return;
          }
        } else if (isLastCol) {
          if (!top && right && !bottom) {
            return;
          }
        } else if (
            !isTopRow &&
            !isBottomRow &&
            !isFirstCol &&
            !isLastCol
        ) {
          return;
        }
      }

      isSingleFrame = false;
    });
  });

  return isSingleFrame;
};