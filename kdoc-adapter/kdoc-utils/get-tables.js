const fillTableObject = require("./table-utils/fill-table-object");
const hasBorders = require("./table-utils/has-borders");
const isDoubleFrame = require("./table-utils/is-double-frame");
const isSingleFrame = require("./table-utils/is-single-frame");
const isTermins = require("./table-utils/is-termins");
const isPictures = require("./table-utils/is-pictures");
const fillByRows = require("./table-utils/fill-by-rows");
const fillByObjects = require("./table-utils/fill-by-objects");
const fillTermins = require("./table-utils/fill-termins");
const fillByPictures = require("./table-utils/fill-by-pictures");

const { innerHtml, findAll, findDescendants, attr } = require("./html-lite");

const docType = require("../constants").DOC_TYPE;

/**
 * Функция для создания объектов-таблиц.
 *
 * @param {object[]} tables массив DOM-нод <table>.
 * @param {*} _$ заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @returns {object[]}
 */
module.exports = (tables, _$, stylesData) => {
  const tablesArray = [];

  tables.forEach((tableElement) => {
    const tableObject = {
      type: "TABLE",
      cells: [],
      firstPid: "",
      lastPid: "",
      docType: docType,
    };

    const tableText = innerHtml(tableElement);
    const rows = findAll(tableElement, "tr");

    if (rows.length > 1) {
      const doubleFrame = isDoubleFrame(rows, _$, stylesData);
      const singleFrame = isSingleFrame(rows, _$, stylesData);
      const isRealTable = hasBorders(tableElement, _$, stylesData);
      const isTerminsSection = isTermins(rows, _$);
      const isPicturesTable = isPictures(rows, _$);

      if (!doubleFrame) {
        fillTableObject(rows, _$, stylesData, tableObject);
        tablesArray.push(tableObject);
      }

      if (!isRealTable && !isPicturesTable) {
        fillByRows(tableObject, rows, _$, stylesData);
      }

      if (!isRealTable && isPicturesTable) {
        fillByPictures(tableObject, tableText, stylesData);
      }

      if (singleFrame) {
        fillByObjects(tableObject, tableText, stylesData);
      }

      if (isTerminsSection) {
        fillTermins(tableObject, tableText, stylesData);
      }
    } else if (
        !hasBorders(tableElement, _$, stylesData) &&
        !isPictures(rows, _$)
    ) {
      fillTableObject(rows, _$, stylesData, tableObject);
      fillByRows(tableObject, rows, _$, stylesData);
      tablesArray.push(tableObject);
    }
  });

  return tablesArray;
};