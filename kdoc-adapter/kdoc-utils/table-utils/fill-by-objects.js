const getParagraph = require("../text-utils/get-paragraph");
const fillTableObject = require("./fill-table-object");

const {
  parseHtml,
  findAll,
  attr,
} = require("../html-lite");

const docType = require("../../constants").DOC_TYPE;
const notRowMarker = require("../../constants").NOT_ROW_MARKER;

const formRegExp =
    /\([\s\S]*?(дата|имя|фамилия|отчество|инициалы|подпись|наименование|должность)[\s\S]*?\)/;

/**
 * Заполняет поле "objects" у табличного объекта, если это не таблица,
 * а элементы в рамке.
 *
 * @param {object} tableObject табличный объект из адаптера.
 * @param {string} tableString HTML-строка с таблицей/рамкой.
 * @param {object} stylesData объект со стилями.
 * @returns {void}
 */
module.exports = (tableObject, tableString, stylesData) => {
  // Если в таблице есть ячейка с указанным шаблоном, то это, скорее всего, просто форма.
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

  // Обрезаем крайние колонки.
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

  // Формируем массив html-строк, полученных из объектов внутри рамки.
  for (let row of rows) {
    const cells =
        row.match(/<td[^>]*?>[\s\S]*?<\/td>/g) || [];

    if (!table) {
      if (cells.length == 1) {
        const cell = cells[0];

        const classMatch = cell.match(/class="([^"]*)"/);
        const className = classMatch ? classMatch[1] : "";

        const styleClass = stylesData[className] || {};

        const left = /solid/.test(styleClass["border-left"]);
        const right = /solid/.test(styleClass["border-right"]);

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

      const firstCellClass =
          stylesData[
              firstClassMatch ? firstClassMatch[1] : ""
              ] || {};

      const lastCellClass =
          stylesData[
              lastClassMatch ? lastClassMatch[1] : ""
              ] || {};

      const leftFirst = /solid/.test(
          firstCellClass["border-left"]
      );

      const rightLast = /solid/.test(
          lastCellClass["border-right"]
      );

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

    const firstCellClass =
        stylesData[
            firstClassMatch ? firstClassMatch[1] : ""
            ] || {};

    const lastCellClass =
        stylesData[
            lastClassMatch ? lastClassMatch[1] : ""
            ] || {};

    const leftBorder = /solid/.test(
        firstCellClass["border-left"]
    );

    const rightBorder = /solid/.test(
        lastCellClass["border-right"]
    );

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

  // Заполняем поле "objects" объектами, полученными из внутренностей рамки.
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

/**
 * Определяет тип границ исходной рамки.
 *
 * @param {object} tableObject табличный объект из адаптера.
 * @param {object} tableElement DOM-нода <table>.
 * @param {object} stylesData объект со стилями.
 * @returns {void}
 */
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

    const leftValue = style["border-left"] || "";
    const rightValue = style["border-right"] || "";
    const topValue = style["border-top"] || "";
    const bottomValue = style["border-bottom"] || "";

    const left = /solid/.test(leftValue);
    const right = /solid/.test(rightValue);
    const top = /solid/.test(topValue);
    const bottom = /solid/.test(bottomValue);

    if (left) {
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

    if (right) {
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

    if (top) {
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

    if (bottom) {
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