const {
  innerHtml,
  textFromHtml,
  findDescendants,
} = require("../html-lite");

/**
 * Проверяет, состоит ли таблица только из картинок/пустых ячеек.
 *
 * ВАЖНО:
 * Это точный порт оригинальной логики.
 * Если в таблице нет текстовых ячеек, она считается isPictures = true.
 * Нельзя менять это на false, иначе пустые служебные таблицы
 * начнут превращаться в ROWS.
 *
 * @param {object[]} rows массив DOM-нод <tr>.
 * @param {*} _$ заглушка вместо cheerio API.
 * @returns {boolean}
 */
module.exports = (rows, _$) => {
  let isPictures = true;

  rows.forEach((row) => {
    findDescendants(row, "td", "p").forEach((cellElement) => {
      const html = innerHtml(cellElement);
      const text = textFromHtml(html).trim();

      if (!text) {
        return;
      }

      if (!text.match(/^<picture[^>]+?><img[^>]+?><\/picture>$/)) {
        isPictures = false;
      }
    });
  });

  return isPictures;
};