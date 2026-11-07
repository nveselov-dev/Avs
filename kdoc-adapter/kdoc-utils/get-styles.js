"use strict";

/**
 * @module get-styles
 * @description Быстрый парсинг CSS-стилей.
 *
 * ВАЖНО:
 * - ключи классов хранятся БЕЗ точки;
 * - пробелы в именах свойств и значениях не обрезаем, чтобы сохранить legacy-поведение;
 * - стиль берём только из <style>...</style>, если такие блоки есть.
 */

const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

function setProp(target, prop) {
  const firstColon = prop.indexOf(":");

  if (firstColon === -1) {
    target[prop] = undefined;
    return;
  }

  const secondColon = prop.indexOf(":", firstColon + 1);

  const propName = prop.slice(0, firstColon);

  target[propName] = secondColon === -1
      ? prop.slice(firstColon + 1)
      : prop.slice(firstColon + 1, secondColon);
}

function parseProps(body, target) {
  let start = 0;
  const len = body.length;

  while (start < len) {
    const semi = body.indexOf(";", start);

    const prop =
        semi === -1
            ? body.slice(start)
            : body.slice(start, semi);

    if (prop.length) {
      setProp(target, prop);
    }

    if (semi === -1) {
      break;
    }

    start = semi + 1;
  }
}

function parseCss(css, stylesData) {
  let i = 0;
  const len = css.length;

  while (i < len) {
    const dot = css.indexOf(".", i);

    if (dot === -1) {
      break;
    }

    const open = css.indexOf("{", dot + 1);

    if (open === -1) {
      break;
    }

    // Регексп-аналог требует хотя бы один символ между "." и "{".
    if (open === dot + 1) {
      i = dot + 1;
      continue;
    }

    const close = css.indexOf("}", open + 1);

    if (close === -1) {
      break;
    }

    const name = css.slice(dot + 1, open);
    const body = css.slice(open + 1, close);

    stylesData[name] = {};
    parseProps(body, stylesData[name]);

    i = close + 1;
  }
}

module.exports = (html) => {
  html = String(html || "");

  const stylesData = {};

  // Отладочный fallback: KDOC_STYLES_FULL=1 нодает старый разбор по всему HTML.
  if (process.env.KDOC_STYLES_FULL === "1") {
    parseCss(html, stylesData);
    return stylesData;
  }

  let foundStyleBlock = false;

  STYLE_BLOCK_RE.lastIndex = 0;

  let match;

  while ((match = STYLE_BLOCK_RE.exec(html)) !== null) {
    foundStyleBlock = true;
    parseCss(match[1], stylesData);
  }

  if (!foundStyleBlock) {
    parseCss(html, stylesData);
  }

  return stylesData;
};