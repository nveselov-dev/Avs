const getParagraph = require("./kdoc-utils/text-utils/get-paragraph");
const getStyles = require("./kdoc-utils/get-styles");
const getTables = require("./kdoc-utils/get-tables");

const { parseHtml, findAll } = require("./kdoc-utils/html-lite");

/**
 * Конвертирует html-строку в объект особого вида.
 *
 * @param {string} html
 * @returns {Promise<object>}
 */
module.exports = async (html) => {
  const stylesData = getStyles(html);

  const root = parseHtml(html);

  const paragraphs = findAll(root, "p");
  const tables = findAll(root, "table");

  const objects = [];

  paragraphs.forEach((element) => {
    const PObject = getParagraph(null, element, stylesData);
    objects.push(PObject);
  });

  const tablesArray = getTables(tables, null, stylesData);

  const resultArray = [];

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];

    const table = tablesArray.find(
        (tableItem) => tableItem.firstPid == object.pid
    );

    if (table) {
      if (!table.firstPid || !table.lastPid) continue;

      if (table.type == "TABLE") {
        resultArray.push(table);
      } else if (table.type == "ROWS") {
        table.rows.forEach((row) => {
          resultArray.push(row);
        });
      } else if (table.type == "OBJECTS") {
        table.objects.forEach((obj) => {
          resultArray.push(obj);
        });
      }

      const firstIdx = table.cells.indexOf(
          table.cells.find((cell) => cell.pid == table.firstPid)
      );

      i += table.cells.length - 1 - firstIdx;
    } else {
      resultArray.push(object);
    }
  }

  if (html.includes("1200082711")) {
    console.log(
        "TABLES DEBUG:",
        tablesArray.map((t) => ({
          type: t.type,
          firstPid: t.firstPid,
          lastPid: t.lastPid,
          cellsCount: Array.isArray(t.cells) ? t.cells.length : undefined,
          rowsCount: Array.isArray(t.rows) ? t.rows.length : undefined,
          objectsCount: Array.isArray(t.objects) ? t.objects.length : undefined,
        }))
    );
  }
  return {
    objects: resultArray,
    styles: stylesData,
  };
};