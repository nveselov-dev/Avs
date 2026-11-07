const { attr, findAll, getBorderFlags } = require("../html-lite");

module.exports = (rows, _$, stylesData) => {
  let isSingleFrame = true;

  const rowCount = rows.length;

  rows.forEach((rowElement, rowIndex) => {
    const tds = findAll(rowElement, "td");
    const colCount = tds.length;

    tds.forEach((cellElement, cellIndex) => {
      if (!isSingleFrame) {
        return;
      }

      const className = attr(cellElement, "class");
      const flags = getBorderFlags(stylesData[className]);

      const left = flags.left;
      const right = flags.right;
      const top = flags.top;
      const bottom = flags.bottom;

      const isTopRow = rowIndex == 0;
      const isBottomRow = rowIndex == rowCount - 1;
      const isFirstCol = cellIndex == 0;
      const isLastCol = cellIndex == colCount - 1;

      if (isTopRow) {
        if (isFirstCol) {
          if (left && top && !right && !bottom) {
            return;
          }

          if (isLastCol && left && top && right && !bottom) {
            return;
          }
        }

        if (isLastCol) {
          if (!left && top && right && !bottom) {
            return;
          }
        } else {
          if (top) {
            return;
          }
        }
      } else if (isBottomRow) {
        if (isFirstCol) {
          if (left && !top && !right && bottom) {
            return;
          }

          if (isLastCol && left && !top && right && bottom) {
            return;
          }
        }

        if (isLastCol) {
          if (!left && !top && right && bottom) {
            return;
          }
        } else {
          if (bottom) {
            return;
          }
        }
      } else {
        if (isFirstCol) {
          if (left && !top && !bottom) {
            return;
          }

          if (isLastCol && left && !top && right && !bottom) {
            return;
          }
        } else if (isLastCol) {
          if (!top && right && !bottom) {
            return;
          }
        } else if (
            !isTopRow &&
            !isBottomRow &&
            !isFirstCol &&
            !isLastCol
        ) {
          return;
        }
      }

      isSingleFrame = false;
    });
  });

  return isSingleFrame;
};