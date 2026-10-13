const getParagraph = require("../text-utils/get-paragraph");
const { parseHtml, findAll } = require("../html-lite");

/**
 * Заполняет табличный объект терминами.
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

    const text = PObject.text
        .trim()
        .replace(
            /<picture[^>]+?><img[^>]+?><\/picture>/g,
            ""
        );

    if (
        !text.match(/[a-z]{2,}|[A-Z][a-z]|[A-Z]{2,}/) ||
        !text.match(/^[A-Za-z,.;()"'/\\*[\]{}\-_\d\s]+$/)
    ) {
      tableObject.objects.push(PObject);
    }
  });
};