import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { loadCache, saveCache, VALID_CATEGORIES } from "../ai.js";

test("VALID_CATEGORIES - has expected list of categories", () => {
  assert.ok(VALID_CATEGORIES.includes("food"));
  assert.ok(VALID_CATEGORIES.includes("bills"));
  assert.ok(VALID_CATEGORIES.includes("other"));
  assert.strictEqual(VALID_CATEGORIES.length, 16);
});

test("loadCache - returns parsed cache from fs.promises.readFile", async (t) => {
  const dummyCache = { "zomato": "food", "jio": "bills" };
  
  t.mock.method(fs.promises, "readFile", async (path, encoding) => {
    return JSON.stringify(dummyCache);
  });

  const cache = await loadCache();
  assert.deepStrictEqual(cache, dummyCache);
});

test("loadCache - handles ENOENT by creating file and returning empty object", async (t) => {
  let createdFile = false;
  let fileContent = "";

  t.mock.method(fs.promises, "readFile", async (path, encoding) => {
    const err = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });

  t.mock.method(fs.promises, "writeFile", async (path, data, encoding) => {
    createdFile = true;
    fileContent = data;
  });

  const cache = await loadCache();
  assert.deepStrictEqual(cache, {});
  assert.strictEqual(createdFile, true);
  assert.strictEqual(fileContent, "{}");
});

test("saveCache - writes JSON stringified data to file", async (t) => {
  let writtenContent = "";
  const mockCache = { "zepto": "grocery" };

  t.mock.method(fs.promises, "writeFile", async (path, data, encoding) => {
    writtenContent = data;
  });

  await saveCache(mockCache);
  const parsed = JSON.parse(writtenContent);
  assert.deepStrictEqual(parsed, mockCache);
});
