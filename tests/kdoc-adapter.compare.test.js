const fs = require("fs");
const path = require("path");

jest.setTimeout(1800000);

function loadAdapter() {
    const candidates = [
        "../kdoc-adapter/kdoc-adapter",
        "../kdoc-adapter",
        "../src/kdoc-adapter/kdoc-adapter",
        "../src/kdoc-adapter",
    ];

    const errors = [];

    for (const candidate of candidates) {
        try {
            const resolved = require.resolve(candidate, { paths: [__dirname] });
            const mod = require(resolved);

            const fn =
                typeof mod === "function"
                    ? mod
                    : mod && typeof mod.default === "function"
                        ? mod.default
                        : mod && typeof mod.kdocAdapter === "function"
                            ? mod.kdocAdapter
                            : null;

            if (fn) {
                return fn;
            }

            errors.push(
                `[${candidate}] модуль загружен, но не экспортирует функцию. ` +
                `typeof mod = ${typeof mod}, keys = ${
                    mod && typeof mod === "object" ? Object.keys(mod).join(", ") : "—"
                }`
            );
        } catch (error) {
            errors.push(`[${candidate}] ${error.message}`);
        }
    }

    throw new Error(
        "Не удалось загрузить адаптер. Реальные ошибки:\n\n" +
        errors.join("\n\n---\n\n")
    );
}

const adapter = loadAdapter();

const ROOT_DIR = path.resolve(__dirname, "..");

const HTML_DIR = path.join(ROOT_DIR, "docs", "htmls");
const JSON_DIR = path.join(ROOT_DIR, "docs", "jsons");

function assertDirectory(dir, label) {
    if (!fs.existsSync(dir)) {
        throw new Error(`Не найдена папка ${label}: ${dir}`);
    }

    if (!fs.statSync(dir).isDirectory()) {
        throw new Error(`Путь не является папкой ${label}: ${dir}`);
    }
}

assertDirectory(HTML_DIR, "HTML");
assertDirectory(JSON_DIR, "JSON");

function collectHtmlFiles(dir) {
    const result = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            result.push(...collectHtmlFiles(fullPath));
        } else if (entry.isFile() && /\.html$/i.test(entry.name)) {
            result.push(fullPath);
        }
    }

    return result;
}

let htmlFiles = collectHtmlFiles(HTML_DIR).sort((a, b) =>
    path.relative(HTML_DIR, a).localeCompare(path.relative(HTML_DIR, b))
);

const ONLY = process.env.KDOC_ONLY ? String(process.env.KDOC_ONLY) : null;

if (ONLY) {
    htmlFiles = htmlFiles.filter((file) =>
        path.basename(file, ".html").toLowerCase().includes(ONLY.toLowerCase())
    );
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function preview(value, max = 800) {
    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    let text;

    if (typeof value === "string") {
        text = value;
    } else {
        try {
            text = JSON.stringify(value, null, 2);

            if (text === undefined) {
                text = String(value);
            }
        } catch (_) {
            text = String(value);
        }
    }

    if (text.length > max) {
        return `${text.slice(0, max)}\n... (обрезано, всего ${text.length} символов)`;
    }

    return text;
}

function findFirstObjectDiff(expected, received, currentPath = "$") {
    if (expected === received) {
        return null;
    }

    if (
        typeof expected === "number" &&
        typeof received === "number" &&
        Number.isNaN(expected) &&
        Number.isNaN(received)
    ) {
        return null;
    }

    const expectedIsArray = Array.isArray(expected);
    const receivedIsArray = Array.isArray(received);

    if (expectedIsArray || receivedIsArray) {
        if (!expectedIsArray || !receivedIsArray) {
            return {
                path: currentPath,
                expected,
                received,
            };
        }

        if (expected.length !== received.length) {
            const min = Math.min(expected.length, received.length);

            for (let i = 0; i < min; i++) {
                const diff = findFirstObjectDiff(
                    expected[i],
                    received[i],
                    `${currentPath}[${i}]`
                );

                if (diff) {
                    return {
                        ...diff,
                        note:
                            `Длина массива разная: expected=${expected.length}, received=${received.length}. ` +
                            `Первое отличие найдено до конца более короткого массива.`,
                    };
                }
            }

            const receivedHasExtra = received.length > expected.length;
            const extraOrMissing = receivedHasExtra ? received[min] : expected[min];

            return {
                path: `${currentPath}[${min}]`,
                expected: receivedHasExtra ? undefined : extraOrMissing,
                received: receivedHasExtra ? extraOrMissing : undefined,
                note: receivedHasExtra
                    ? `В received есть лишние объекты начиная с индекса ${min}. ` +
                    `expected.length=${expected.length}, received.length=${received.length}.`
                    : `В received не хватает объектов начиная с индекса ${min}. ` +
                    `expected.length=${expected.length}, received.length=${received.length}.`,
            };
        }

        for (let i = 0; i < expected.length; i++) {
            const diff = findFirstObjectDiff(
                expected[i],
                received[i],
                `${currentPath}[${i}]`
            );

            if (diff) {
                return diff;
            }
        }

        return null;
    }

    const expectedIsObject = isPlainObject(expected);
    const receivedIsObject = isPlainObject(received);

    if (expectedIsObject || receivedIsObject) {
        if (!expectedIsObject || !receivedIsObject) {
            return {
                path: currentPath,
                expected,
                received,
            };
        }

        const expectedKeys = Object.keys(expected);
        const receivedKeys = Object.keys(received);

        if (expectedKeys.length !== receivedKeys.length) {
            const missingFromReceived = expectedKeys.filter(
                (key) => !Object.prototype.hasOwnProperty.call(received, key)
            );

            const extraInReceived = receivedKeys.filter(
                (key) => !Object.prototype.hasOwnProperty.call(expected, key)
            );

            return {
                path: `${currentPath}.__keys__`,
                expected: {
                    keys: expectedKeys,
                    missingFromReceived,
                },
                received: {
                    keys: receivedKeys,
                    extraInReceived,
                },
            };
        }

        for (let i = 0; i < expectedKeys.length; i++) {
            if (expectedKeys[i] !== receivedKeys[i]) {
                return {
                    path: `${currentPath}.__keys__[${i}]`,
                    expected: expectedKeys[i],
                    received: receivedKeys[i],
                };
            }
        }

        for (const key of expectedKeys) {
            const diff = findFirstObjectDiff(
                expected[key],
                received[key],
                `${currentPath}.${key}`
            );

            if (diff) {
                return diff;
            }
        }

        return null;
    }

    return {
        path: currentPath,
        expected,
        received,
    };
}

function normalizeJsonText(text) {
    return String(text)
        .replace(/^﻿/, "")
        .replace(/\r\n?/g, "\n")
        .replace(/\n+$/, "");
}

function escapeControlChars(text) {
    return text
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

function snippet(text, index, radius = 120) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);

    return escapeControlChars(text.slice(start, end));
}

function findFirstStringDiff(expected, received) {
    const minLength = Math.min(expected.length, received.length);

    for (let i = 0; i < minLength; i++) {
        if (expected[i] !== received[i]) {
            return {
                reason: "char",
                index: i,
                expected: expected[i],
                received: received[i],
                expectedCode: expected.codePointAt(i),
                receivedCode: received.codePointAt(i),
                expectedSnippet: snippet(expected, i),
                receivedSnippet: snippet(received, i),
            };
        }
    }

    if (expected.length !== received.length) {
        return {
            reason: "length",
            index: minLength,
            expectedLength: expected.length,
            receivedLength: received.length,
            expectedSnippet: snippet(expected, minLength),
            receivedSnippet: snippet(received, minLength),
        };
    }

    return null;
}

function assertSameJson(file, expectedJson, receivedJson) {
    const expectedNormalized = normalizeJsonText(expectedJson);
    const receivedNormalized = normalizeJsonText(receivedJson);

    let expectedObject;
    let receivedObject;

    try {
        expectedObject = JSON.parse(expectedNormalized);
    } catch (error) {
        throw new Error(
            `[${file}] Не удалось распарсить ожидаемый JSON: ${error.message}`
        );
    }

    try {
        receivedObject = JSON.parse(receivedNormalized);
    } catch (error) {
        throw new Error(
            `[${file}] Не удалось распарсить полученный JSON: ${error.message}\n\nПолученный JSON начала:\n${preview(
                receivedNormalized,
                1500
            )}`
        );
    }

    const objectDiff = findFirstObjectDiff(expectedObject, receivedObject);

    if (objectDiff) {
        const details = [];

        details.push(`[${file}] Первое расхождение по структуре/значениям:`);
        details.push(`Путь: ${objectDiff.path}`);

        if (objectDiff.note) {
            details.push(`Примечание: ${objectDiff.note}`);
        }

        details.push("");
        details.push("Ожидалось:");
        details.push(preview(objectDiff.expected, 5000));

        details.push("");
        details.push("Получено:");
        details.push(preview(objectDiff.received, 5000));

        throw new Error(details.join("\n"));
    }

    const stringDiff = findFirstStringDiff(
        expectedNormalized,
        receivedNormalized
    );

    if (stringDiff) {
        if (stringDiff.reason === "length") {
            throw new Error(
                `[${file}] Структура совпадает, но длина JSON разная.\n\n` +
                `Позиция: ${stringDiff.index}\n` +
                `Ожидаемая длина: ${stringDiff.expectedLength}\n` +
                `Полученная длина: ${stringDiff.receivedLength}\n\n` +
                `Контекст expected:\n${stringDiff.expectedSnippet}\n\n` +
                `Контекст received:\n${stringDiff.receivedSnippet}`
            );
        }

        throw new Error(
            `[${file}] Структура совпадает, но есть расхождение в форматировании JSON.\n\n` +
            `Позиция: ${stringDiff.index}\n\n` +
            `Ожидался символ: ${JSON.stringify(stringDiff.expected)} ` +
            `(code: ${stringDiff.expectedCode})\n` +
            `Получен символ: ${JSON.stringify(stringDiff.received)} ` +
            `(code: ${stringDiff.receivedCode})\n\n` +
            `Контекст expected:\n${stringDiff.expectedSnippet}\n\n` +
            `Контекст received:\n${stringDiff.receivedSnippet}`
        );
    }
}

describe("KDoc Adapter comparison", () => {
    it("сравнивает все фикстуры и останавливается на первом несовпадении", async () => {
        if (!htmlFiles.length) {
            throw new Error(
                `Не найдено HTML-фикстур в папке: ${HTML_DIR}` +
                (ONLY ? `\nФильтр KDOC_ONLY=${ONLY}` : "")
            );
        }

        let totalMs = 0;
        let processedFiles = 0;

        for (const htmlPath of htmlFiles) {
            const relHtmlPath = path.relative(HTML_DIR, htmlPath);
            const jsonPath = path.join(
                JSON_DIR,
                relHtmlPath.replace(/\.html$/i, ".json")
            );

            const file = path.relative(process.cwd(), htmlPath);

            if (!fs.existsSync(jsonPath)) {
                throw new Error(
                    `[${file}] Не найден ожидаемый JSON:\n` +
                    `HTML: ${htmlPath}\n` +
                    `Ожидаемый JSON: ${jsonPath}`
                );
            }

            const html = fs.readFileSync(htmlPath, "utf8");
            const expectedJson = fs.readFileSync(jsonPath, "utf8");

            const startedAt = Date.now();

            const result = await adapter(html);

            const elapsedMs = Date.now() - startedAt;

            totalMs += elapsedMs;
            processedFiles++;

            console.log(`✅ ${file} — ${elapsedMs} ms`);

            const receivedJson = JSON.stringify(result, null, 2);

            assertSameJson(file, expectedJson, receivedJson);
        }

        if (processedFiles > 0) {
            const averageMs = (totalMs / processedFiles).toFixed(1);

            console.log(`\nСуммарно: ${totalMs} ms`);
            console.log(`Среднее: ${averageMs} ms`);
        }
    });
});