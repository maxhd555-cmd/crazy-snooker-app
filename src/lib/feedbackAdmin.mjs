export function reportStatusLabel(status) {
  return ({ new: "ใหม่", in_progress: "กำลังดำเนินการ", resolved: "แก้ไขแล้ว" })[status] || status;
}

export function displayNewReportCount(count) {
  const value = Math.max(0, Number(count) || 0);
  return value > 99 ? "99+" : String(value);
}

export function feedbackDetailRows(report, categoryLabel, viewLabel) {
  const rows = [
    { label: "สถานะ", value: reportStatusLabel(report.status) },
    { label: "เวลาที่แจ้ง", value: report.createdAt || "—" },
    { label: "หน้าที่รายงาน", value: viewLabel || report.currentView || "—" },
  ];
  if (report.contact) rows.push({ label: "ข้อมูลติดต่อ", value: report.contact });
  if (categoryLabel) rows.unshift({ label: "ประเภท", value: categoryLabel });
  return rows;
}
