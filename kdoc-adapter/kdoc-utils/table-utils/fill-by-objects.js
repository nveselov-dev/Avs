const getParagraph = require("../text-utils/get-paragraph");
const fillTableObject = require("./fill-table-object");

const {
  parseHtml,
  findAll,
  attr,
  getBorderFlags,
} = require("../html-lite");

const docType = require("../../constants").DOC_TYPE;
const notRowMarker = require("../../constants").NOT_ROW_MARKER;

const formRegExp =
    /\([\s\S]*?(дата|имя|фамилия|отчество|инициалы|подпись|наименование|должность)[\s\S]*?\)/;

module.exports = (tableObject, tableString, stylesData) => {
  if (
      tableObject.cells.find((cell) =>
          cell.text.trim().match(formRegExp)
      )
  ) {
    return;
  }

  tableObject.type = "OBJECTS";
  tableObject.objects = [];

  const colMatches = tableString.match(
      /<col[^>]*?>([\s\S]*?<\/col>)?/g
  );

  const columsNumber = colMatches ? colMatches.length : 0;

  let colNumb = 1;
  let colString = "";

  const cutHtml = tableString
      .replace(
          /<col[^>]*?>([\s\S]*?<\/col>)?/g,
          (str) => {
            if (colNumb == 1) {
              colNumb++;
              return "";
            }

            if (colNumb == columsNumber) {
              return "";
            }

            colNumb++;
            colString += str;
            return str;
          }
      )
      .replace(
          /<tr[^>]*?>[\s\S]*?<\/tr>/g,
          (str) => {
            const cells = str.split(/<td/);

            if (cells.length == 2) {
              return str.replace(
                  /<\/td>[\s\S]*?<\/tr>/,
                  (s) => notRowMarker + s
              );
            }

            const newRow = `<tr><td${cells
                .slice(2, cells.length - 1)
                .join("<td")}</tr>`;

            return newRow;
          }
      );

  const htmlStrings = [];

  const rows =
      cutHtml.match(/<tr[^>]*?>[\s\S]*?<\/tr>/g) || [];

  let table = "";

  for (let row of rows) {
    const cells =
        row.match(/<td[^>]*?>[\s\S]*?<\/td>/g) || [];

    if (!table) {
      if (cells.length == 1) {
        const cell = cells[0];

        const classMatch = cell.match(/class="([^"]*)"/);
        const className = classMatch ? classMatch[1] : "";

        const flags = getBorderFlags(stylesData[className]);

        const left = flags.left;
        const right = flags.right;

        if (
            (!left && !right) ||
            cell.match(notRowMarker)
        ) {
          const paragraphs =
              cell.match(/<p[^>]*?>[\s\S]*?<\/p>/g) || [];

          paragraphs.forEach((paragraph) => {
            if (cell.match(notRowMarker)) {
              htmlStrings.push(
                  paragraph.replace(notRowMarker, "")
              );
            } else {
              htmlStrings.push(paragraph);
            }
          });

          continue;
        }
      }

      const firstCell = cells[0];
      const lastCell = cells[cells.length - 1];

      const firstClassMatch =
          firstCell && firstCell.match(/class="([^"]*)"/);
      const lastClassMatch =
          lastCell && lastCell.match(/class="([^"]*)"/);

      const firstFlags = getBorderFlags(
          stylesData[
              firstClassMatch ? firstClassMatch[1] : ""
              ]
      );

      const lastFlags = getBorderFlags(
          stylesData[
              lastClassMatch ? lastClassMatch[1] : ""
              ]
      );

      const leftFirst = firstFlags.left;
      const rightLast = lastFlags.right;

      if (!leftFirst && !rightLast) {
        htmlStrings.push(row);
        continue;
      }

      table = row;
      continue;
    }

    const firstCell = cells[0];
    const lastCell = cells[cells.length - 1];

    const firstClassMatch =
        firstCell && firstCell.match(/class="([^"]*)"/);
    const lastClassMatch =
        lastCell && lastCell.match(/class="([^"]*)"/);

    const firstFlags = getBorderFlags(
        stylesData[
            firstClassMatch ? firstClassMatch[1] : ""
            ]
    );

    const lastFlags = getBorderFlags(
        stylesData[
            lastClassMatch ? lastClassMatch[1] : ""
            ]
    );

    const leftBorder = firstFlags.left;
    const rightBorder = lastFlags.right;

    if (
        (leftBorder || rightBorder) &&
        !row.match(notRowMarker)
    ) {
      table += row;
    } else {
      htmlStrings.push(
          `<table>${colString}${table}</table>`
      );

      if (row.match(notRowMarker)) {
        htmlStrings.push(
            row.replace(notRowMarker, "")
        );
      } else {
        htmlStrings.push(row);
      }

      table = "";
    }
  }

  if (table) {
    htmlStrings.push(
        `<table>${colString}${table}</table>`
    );
  }

  for (let string of htmlStrings) {
    if (string.match(/^<p/)) {
      const root = parseHtml(string);
      const element = findAll(root, "p")[0];

      if (element) {
        const PObject = getParagraph(
            null,
            element,
            stylesData
        );

        tableObject.objects.push(PObject);
      }
    } else if (string.match(/^<table/)) {
      const TObject = {
        type: "TABLE",
        cells: [],
        firstPid: "",
        lastPid: "",
        docType: docType,
        fromSingleFrame: true,
      };

      const root = parseHtml(string);
      const tableElement = findAll(root, "table")[0];

      if (tableElement) {
        const trs = findAll(tableElement, "tr");

        fillTableObject(
            trs,
            null,
            stylesData,
            TObject
        );

        setFrameBorders(
            TObject,
            tableElement,
            stylesData
        );

        tableObject.objects.push(TObject);
      }
    }
  }
};

function setFrameBorders(
    tableObject,
    tableElement,
    stylesData
) {
  findAll(tableElement, "td").forEach((element) => {
    const className = attr(element, "class");

    if (!className) {
      return;
    }

    const style = stylesData[className] || {};
    const flags = getBorderFlags(style);

    const leftValue = style["border-left"] || "";
    const rightValue = style["border-right"] || "";
    const topValue = style["border-top"] || "";
    const bottomValue = style["border-bottom"] || "";

    if (flags.left) {
      if (!tableObject.borderColor) {
        tableObject.borderColor = String(leftValue)
            .trim()
            .split(/\s+/)[2];
      }

      if (!tableObject.borderThickness) {
        tableObject.borderThickness = String(leftValue)
            .trim()
            .split(/\s+/)[0];
      }
    }

    if (flags.right) {
      if (!tableObject.borderColor) {
        tableObject.borderColor = String(rightValue)
            .trim()
            .split(/\s+/)[2];
      }

      if (!tableObject.borderThickness) {
        tableObject.borderThickness = String(rightValue)
            .trim()
            .split(/\s+/)[0];
      }
    }

    if (flags.top) {
      if (!tableObject.borderColor) {
        tableObject.borderColor = String(topValue)
            .trim()
            .split(/\s+/)[2];
      }

      if (!tableObject.borderThickness) {
        tableObject.borderThickness = String(topValue)
            .trim()
            .split(/\s+/)[0];
      }
    }

    if (flags.bottom) {
      if (!tableObject.borderColor) {
        tableObject.borderColor = String(bottomValue)
            .trim()
            .split(/\s+/)[2];
      }

      if (!tableObject.borderThickness) {
        tableObject.borderThickness = String(bottomValue)
            .trim()
            .split(/\s+/)[0];
      }
    }
  });
}