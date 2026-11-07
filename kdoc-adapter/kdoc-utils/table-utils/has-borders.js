const { attr, findAll, getBorderFlags } = require("../html-lite");

module.exports = (table, _$, stylesData) => {
  let hasBorders = false;

  findAll(table, "td").forEach((element) => {
    const className = attr(element, "class");

    if (!className) {
      return;
    }

    const flags = getBorderFlags(stylesData[className]);

    if (flags.left || flags.right || flags.top || flags.bottom) {
      hasBorders = true;
    }
  });

  return hasBorders;
};