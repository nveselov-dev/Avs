const {
  findDescendants,
  text,
} = require("../html-lite");

/**
 * Проверяет, состоит ли таблица только из картинок.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ заглушка вместо cheerio API.
 * @returns {boolean} true, если таблица состоит из картинок.
 */
module.exports = (rows, _$) => {
  let isPictures = true;

  rows.forEach((row) => {
    findDescendants(row, "td", "p").forEach((cellElement) => {
      const textValue = text(cellElement).trim();

      if (!textValue) {
        return;
      }

      if (!textValue.match(/^<picture[^>]+?><img[^>]+?><\/picture>$/)) {
        isPictures = false;
      }
    });
  });

  return isPictures;
};