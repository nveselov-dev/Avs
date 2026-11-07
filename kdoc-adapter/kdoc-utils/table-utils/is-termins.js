const {
  findAll,
  textAfterPadding1em,
} = require("../html-lite");

/**
 * Проверяет, что таблица является разделом терминов.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ заглушка вместо cheerio API.
 * @returns {boolean} true, если таблица похожа на термины.
 */
module.exports = (rows, _$) => {
  let isTermins = false;

  rows.forEach((row) => {
    let firstCellMatch = false;
    let lastCellMatch = false;
    let isFirstCell = false;

    const tds = findAll(row, "td");
    const rowLength = tds.length;

    tds.forEach((cellElement, cellIndex) => {
      const text = textAfterPadding1em(cellElement).trim();

      if (text) {
        isFirstCell = true;
      }

      if (
          isFirstCell &&
          text.match(
              /^\d+(\.\d+)*\s+[А-ЯЁа-яё\s]+?[:;][А-ЯЁа-яё\s]+?/
          )
      ) {
        firstCellMatch = true;
      }

      if (
          cellIndex == rowLength - 1 &&
          text.match(/[a-z]{2,}|[A-Z][a-z]|[A-Z]{2,}/) &&
          text.match(/^[A-Za-z,.;()"'/\\*[\]{}\-_\d\s]+$/)
      ) {
        lastCellMatch = true;
      }
    });

    if (lastCellMatch && firstCellMatch) {
      isTermins = true;
    }
  });

  return isTermins;
};