import { describe, expect, it } from "vitest";
import { TOUR_STORAGE_KEY, completeTour, feedbackIsValid, filterManualSections, isTourComplete, manualPdfPath, manualSections, resetTour, tourSteps } from "../src/lib/guidedSupport.mjs";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

describe("guided support", () => {
  it("starts incomplete and can be completed and reset", () => {
    const storage = memoryStorage();
    expect(isTourComplete(storage)).toBe(false);
    completeTour(storage);
    expect(storage.getItem(TOUR_STORAGE_KEY)).toBe("complete");
    expect(isTourComplete(storage)).toBe(true);
    resetTour(storage);
    expect(isTourComplete(storage)).toBe(false);
  });

  it("defines a PDF asset and navigable tour steps", () => {
    expect(manualPdfPath).toMatch(/\.pdf$/);
    expect(tourSteps.map((step) => step.view)).toEqual(["pos", "pos", "console", "inventory", "history", "settings"]);
  });

  it("finds manual topics by title or explanatory text and validates feedback detail", () => {
    expect(filterManualSections(manualSections, "บาร์โค้ด").map((section) => section.id)).toEqual(["pos", "inventory"]);
    expect(filterManualSections(manualSections, "ไม่มีหัวข้อนี้")).toEqual([]);
    expect(feedbackIsValid("สแกนบาร์โค้ดแล้วไม่พบสินค้าในคลัง")).toBe(true);
    expect(feedbackIsValid("สั้น")).toBe(false);
  });
});
