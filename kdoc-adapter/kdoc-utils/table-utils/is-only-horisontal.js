const { attr, findAll, getBorderFlags } = require("../html-lite");

module.exports = (rows, _$, stylesData) => {
  let isHorizontalLinesOnly = true;

  rows.forEach((rowElement, rowIndex) => {
    findAll(rowElement, "td").forEach((cellElement) => {
      if (!isHorizontalLinesOnly) {
        return;
      }

      const className = attr(cellElement, "class");
      const flags = getBorderFlags(stylesData[className]);

      const top = flags.top;
      const bottom = flags.bottom;
      const left = flags.left;
      const right = flags.right;

      if (rowIndex == 0) {
        if (top && !bottom && !left && !right) {
          return;
        }
      } else if (rowIndex == rows.length - 1) {
        if (!top && bottom && !left && !right) {
          return;
        }
      } else {
        if (!top && !bottom && !left && !right) {
          return;
        }
      }

      isHorizontalLinesOnly = false;
    });
  });

  return isHorizontalLinesOnly;
};