const { attr, findAll, getBorderFlags } = require("../html-lite");

module.exports = (rows, _$, stylesData) => {
  let isDoubleFrame = true;

  const rowCount = rows.length;

  if (!rowCount) {
    return false;
  }

  const colCount = findAll(rows[0], "td").length;

  const border = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };

  for (let i = 0; i < rowCount - 2; i++) {
    border.left[i] = false;
    border.right[i] = false;
  }

  for (let j = 0; j < colCount - 2; j++) {
    border.top[j] = false;
    border.bottom[j] = false;
  }

  rows.forEach((rowElement, rowIndex) => {
    findAll(rowElement, "td").forEach((cellElement, cellIndex) => {
      if (!isDoubleFrame) {
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

      const isSecondRow = rowIndex == 1;
      const isPreLastRow = rowIndex == rowCount - 2;
      const isSecondCol = cellIndex == 1;
      const isPreLastCol = cellIndex == colCount - 2;

      if (isTopRow) {
        if (isFirstCol) {
          if (left && !right && top && !bottom) {
            return;
          }
        } else if (isLastCol) {
          if (!left && right && top && !bottom) {
            return;
          }
        } else {
          if (!left && !right && top) {
            if (bottom) {
              border.top[cellIndex - 1] = true;
            }
            return;
          }
        }
      } else if (isBottomRow) {
        if (isFirstCol) {
          if (left && !right && !top && bottom) {
            return;
          }
        } else if (isLastCol) {
          if (!left && right && !top && bottom) {
            return;
          }
        } else {
          if (!left && !right && bottom) {
            if (top) {
              border.bottom[cellIndex - 1] = true;
            }
            return;
          }
        }
      } else if (isSecondRow) {
        if (isFirstCol) {
          if (left && !top && !bottom) {
            if (right) {
              border.left[rowIndex - 1] = true;
            }
            return;
          }
        } else if (isLastCol) {
          if (right && !top && !bottom) {
            if (left) {
              border.right[rowIndex - 1] = true;
            }
            return;
          }
        } else if (isSecondCol) {
          if (rowCount == 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              return;
            } else if (colCount > 3) {
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!right) {
                return;
              }
            }
          } else if (rowCount > 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (!bottom) {
                return;
              }
            } else if (colCount > 3) {
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (!bottom && !right) {
                return;
              }
            }
          }
        } else if (isPreLastCol) {
          if (rowCount == 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              return;
            } else if (colCount > 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!left) {
                return;
              }
            }
          } else if (rowCount > 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (!bottom) {
                return;
              }
            } else if (colCount > 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!bottom && !left) {
                return;
              }
            }
          }
        }
      } else if (isPreLastRow) {
        if (isFirstCol) {
          if (left && !top && !bottom) {
            if (right) {
              border.right[rowIndex - 1] = true;
            }
            return;
          }
        } else if (isLastCol) {
          if (right && !top && !bottom) {
            if (left) {
              border.left[rowIndex - 1] = true;
            }
            return;
          }
        } else if (isSecondCol) {
          if (rowCount == 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              return;
            } else if (colCount > 3) {
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!right) {
                return;
              }
            }
          } else if (rowCount > 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!top) {
                return;
              }
            } else if (colCount > 3) {
              if (!top && !right) {
                return;
              }
            }
          }
        } else if (isPreLastCol) {
          if (rowCount == 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              return;
            } else if (colCount > 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (top) {
                border.top[cellIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!left) {
                return;
              }
            }
          } else if (rowCount > 3) {
            if (colCount == 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (left) {
                border.left[rowIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!top) {
                return;
              }
            } else if (colCount > 3) {
              if (right) {
                border.right[rowIndex - 1] = true;
              }
              if (bottom) {
                border.bottom[cellIndex - 1] = true;
              }
              if (!top && !left) {
                return;
              }
            }
          }
        }
      }

      isDoubleFrame = false;
    });
  });

  let fullBorder = true;

  for (let i = 0; i < rowCount - 2; i++) {
    if (!border.left[i]) {
      fullBorder = false;
      break;
    }
    if (!border.right[i]) {
      fullBorder = false;
      break;
    }
  }

  for (let j = 0; j < colCount - 2; j++) {
    if (!border.top[j]) {
      fullBorder = false;
      break;
    }
    if (!border.bottom[j]) {
      fullBorder = false;
      break;
    }
  }

  return isDoubleFrame && fullBorder;
};