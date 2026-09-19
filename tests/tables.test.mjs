import { describe, expect, it } from "vitest";
import { createTableRepository, mapTableRow, parseExpectedEndAt } from "../server/tables.mjs";

describe("persistent table sessions", () => {
  it("maps stored table values and accepts a valid end time", () => {
    expect(mapTableRow({ id: "t3", label: "โต๊ะ 03", status: "occupied", customerName: "คุณวิชัย", expectedEndAt: "2026-08-25T12:30:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z" })).toEqual(expect.objectContaining({ id: "t3", customerName: "คุณวิชัย", expectedEndAt: "2026-08-25T12:30:00.000Z" }));
    expect(parseExpectedEndAt("2026-08-25T12:30:00.000Z")).toBeInstanceOf(Date);
    expect(() => parseExpectedEndAt("not-a-date")).toThrow("เวลาเล่นสิ้นสุดไม่ถูกต้อง");
  });

  it("claims one near-end alert record at most once while it is already sending", async () => {
    const calls = [];
    let claimAvailable = true;
    const repository = createTableRepository({ execute: async (sql, values = []) => {
      calls.push({ sql, values });
      if (sql.startsWith("UPDATE near_end_alerts SET status = 'pending'")) return [{ affectedRows: 0 }];
      if (sql.startsWith("INSERT IGNORE INTO near_end_alerts")) return [{ affectedRows: 1 }];
      if (sql.startsWith("UPDATE near_end_alerts SET status = 'sending'")) return [{ affectedRows: claimAvailable ? 1 : 0 }];
      throw new Error(`unexpected query: ${sql}`);
    } });
    const candidate = { id: "t3", expectedEndAt: "2026-08-25T12:30:00.000Z", remainingMinutes: 8 };
    expect(await repository.claimNearEndAlert(candidate)).toBe(true);
    claimAvailable = false;
    expect(await repository.claimNearEndAlert(candidate)).toBe(false);
    expect(calls.filter((call) => call.sql.startsWith("UPDATE near_end_alerts SET status = 'sending'")).length).toBe(2);
  });
});
