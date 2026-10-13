const { attr, findAll } = require("../html-lite");

/**
 * Проверяет, что таблица имеет только верхнюю и нижнюю границу.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ Заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @returns {boolean} true, если у таблицы только горизонтальные линии.
 */
module.exports = (rows, _$, stylesData) => {
  let isHorizontalLinesOnly = true;

  rows.forEach((rowElement, rowIndex) => {
    findAll(rowElement, "td").forEach((cellElement) => {
      if (!isHorizontalLinesOnly) {
        return;
      }

      const className = attr(cellElement, "class");
      const styleClass = stylesData[className] || {};

      const top = /solid/.test(styleClass["border-top"]);
      const bottom = /solid/.test(styleClass["border-bottom"]);
      const left = /solid/.test(styleClass["border-left"]);
      const right = /solid/.test(styleClass["border-right"]);

      if (rowIndex == 0) {
        if (top && !bottom && !left && !right) {
          return;
        }
      } else if (rowIndex == rows.length - 1) {
        if (!top && bottom && !left && !right) {
          return;
        }
      } else {
        if (!top && !bottom && !left && !right) {
          return;
        }
      }

      isHorizontalLinesOnly = false;
    });
  });

  return isHorizontalLinesOnly;
};