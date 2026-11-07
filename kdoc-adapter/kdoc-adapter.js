const getParagraph = require("./kdoc-utils/text-utils/get-paragraph");
const getStyles = require("./kdoc-utils/get-styles");
const getTables = require("./kdoc-utils/get-tables");

const { parseHtml, findAll, prepareHtml } = require("./kdoc-utils/html-lite");

module.exports = async (rawHtml) => {
  const stylesData = getStyles(rawHtml);

  const html = prepareHtml(rawHtml);

  const root = parseHtml(html);

  const paragraphs = findAll(root, "p");
  const tables = findAll(root, "table");

  const objects = [];

  paragraphs.forEach((element) => {
    const PObject = getParagraph(null, element, stylesData);
    objects.push(PObject);
  });

  const tablesArray = getTables(tables, null, stylesData);

  const tableByFirstPid = new Map();

  for (const table of tablesArray) {
    if (table.firstPid && !tableByFirstPid.has(table.firstPid)) {
      tableByFirstPid.set(table.firstPid, table);
    }
  }

  const tableFirstIdx = new WeakMap();

  for (const table of tablesArray) {
    let firstIdx = -1;

    if (Array.isArray(table.cells)) {
      for (let j = 0; j < table.cells.length; j++) {
        const cell = table.cells[j];

        if (cell && cell.pid == table.firstPid) {
          firstIdx = j;
          break;
        }
      }
    }

    tableFirstIdx.set(table, firstIdx);
  }

  const resultArray = [];

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];

    const table = tableByFirstPid.get(object.pid);

    if (table) {
      if (!table.firstPid || !table.lastPid) {
        continue;
      }

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

      const firstIdx = tableFirstIdx.get(table);

      i += table.cells.length - 1 - firstIdx;
    } else {
      resultArray.push(object);
    }
  }

  return {
    objects: resultArray,
    styles: stylesData,
  };
};