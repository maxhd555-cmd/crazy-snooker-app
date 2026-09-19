import { describe, expect, it } from "vitest";
import { buildFeedbackFilters, createFeedbackRepository, feedbackStatuses, isFeedbackStatus, validateInternalNote } from "../server/feedback.mjs";
import { displayNewReportCount, feedbackDetailRows, reportStatusLabel } from "../src/lib/feedbackAdmin.mjs";

describe("feedback administration lifecycle", () => {
  it("uses a closed set of report statuses", () => {
    expect(feedbackStatuses).toEqual(["new", "in_progress", "resolved"]);
    expect(isFeedbackStatus("in_progress")).toBe(true);
    expect(isFeedbackStatus("deleted")).toBe(false);
  });

  it("builds safe category and status filters and rejects invalid report states", () => {
    expect(buildFeedbackFilters({ category: "problem", status: "new" })).toEqual({ where: "WHERE category = ? AND status = ?", values: ["problem", "new"] });
    expect(buildFeedbackFilters({})).toEqual({ where: "", values: [] });
    expect(() => buildFeedbackFilters({ status: "deleted" })).toThrow("สถานะไม่ถูกต้อง");
  });

  it("returns report detail values without markup and persists a valid status update through the repository", async () => {
    const calls = [];
    const repository = createFeedbackRepository({ execute: async (sql, values) => {
      calls.push({ sql, values });
      return sql.startsWith("UPDATE") ? [{ affectedRows: 1 }] : [[{ id: 8, category: "problem", message: "พบปัญหาที่หน้าจอ POS", contact: "staff@club.test", currentView: "pos", createdAt: "2026-08-22T09:00:00.000Z", status: "new" }]];
    } });
    const reports = await repository.list({ category: "problem", status: "new" });
    const update = await repository.updateStatus(8, "resolved");
    expect(reports[0].message).toBe("พบปัญหาที่หน้าจอ POS");
    expect(update).toEqual({ id: 8, status: "resolved" });
    expect(calls[1].values).toEqual(["resolved", 8]);
    expect(reportStatusLabel("in_progress")).toBe("กำลังดำเนินการ");
    expect(feedbackDetailRows(reports[0], "ปัญหาการใช้งาน", "จุดขาย POS")).toEqual(expect.arrayContaining([{ label: "ประเภท", value: "ปัญหาการใช้งาน" }, { label: "ข้อมูลติดต่อ", value: "staff@club.test" }]));
  });

  it("formats the new-report badge and validates internal-note data without a database write", () => {
    expect(displayNewReportCount(0)).toBe("0");
    expect(displayNewReportCount(100)).toBe("99+");
    expect(validateInternalNote("ตรวจสอบการเชื่อมต่อแล้ว")).toBe("ตรวจสอบการเชื่อมต่อแล้ว");
    expect(() => validateInternalNote(" ")).toThrow("บันทึกภายในต้องมีความยาว");
  });

  it("counts new reports and keeps authorized internal notes separate from report content", async () => {
    const calls = [];
    const repository = createFeedbackRepository({ execute: async (sql, values = []) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT COUNT")) return [[{ count: 3 }]];
      if (sql.startsWith("SELECT id FROM feedback_reports")) return [[{ id: 8 }]];
      if (sql.startsWith("INSERT INTO feedback_internal_notes")) return [{ insertId: 21 }];
      if (sql.includes("FROM feedback_internal_notes")) return [[{ id: 21, feedbackId: 8, noteBody: "กำลังประสานงาน", authorContext: "ผู้ดูแลระบบ", createdAt: "2026-08-22T10:00:00.000Z" }]];
      throw new Error(`unexpected query: ${sql}`);
    } });
    expect(await repository.countNew()).toBe(3);
    expect(await repository.addNote(8, { noteBody: "กำลังประสานงาน" })).toEqual(expect.objectContaining({ id: 21, feedbackId: 8, authorContext: "ผู้ดูแลระบบ" }));
    expect(await repository.listNotes(8)).toEqual([expect.objectContaining({ noteBody: "กำลังประสานงาน" })]);
    expect(calls.some((call) => call.sql.startsWith("INSERT INTO feedback_internal_notes"))).toBe(true);
  });
});
