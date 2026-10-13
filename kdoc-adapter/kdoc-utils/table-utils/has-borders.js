const { attr, findAll } = require("../html-lite");

/**
 * Проверяет, есть ли у таблицы хоть какие-нибудь границы.
 *
 * @param {object} table DOM-нода <table>.
 * @param {*} _$ Заглушка вместо cheerio API.
 * @param {object} stylesData объект со стилями.
 * @returns {boolean} true, если границы есть.
 */
module.exports = (table, _$, stylesData) => {
  let hasBorders = false;

  findAll(table, "td").forEach((element) => {
    const className = attr(element, "class");

    if (!className) {
      return;
    }

    const style = stylesData[className] || {};

    if (
        /solid/.test(style["border-left"]) ||
        /solid/.test(style["border-right"]) ||
        /solid/.test(style["border-top"]) ||
        /solid/.test(style["border-bottom"])
    ) {
      hasBorders = true;
    }
  });

  return hasBorders;
};