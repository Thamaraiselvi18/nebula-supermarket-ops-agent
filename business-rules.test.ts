import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../src/db/schema.js";

describe("documented business rules", () => {
  it("schema migrates", () => {
    const db = new Database(":memory:");
    migrate(db);
    expect(db.prepare("select name from sqlite_master where type='table' and name='products'").get()).toBeTruthy();
  });
});
