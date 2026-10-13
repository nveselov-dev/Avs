const getParagraph = require("../text-utils/get-paragraph");
const { parseHtml, findAll } = require("../html-lite");

/**
 * Заполняет табличный объект картинками/параграфами.
 *
 * @param {object} tableObject табличный объект из адаптера.
 * @param {string} tableText HTML-строка с содержимым таблицы.
 * @param {object} stylesData объект со стилями.
 * @returns {void}
 */
module.exports = (tableObject, tableText, stylesData) => {
  tableObject.type = "OBJECTS";
  tableObject.objects = [];

  const root = parseHtml(tableText);
  const paragraphs = findAll(root, "p");

  paragraphs.forEach((element) => {
    const PObject = getParagraph(null, element, stylesData);
    tableObject.objects.push(PObject);
  });
};