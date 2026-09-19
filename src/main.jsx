import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { applyStockAdjustment, findProductByBarcode } from "./lib/inventory.mjs";
import { clientFilterTransactions, receiptMailto, shiftSummaryCsv, summarizeTransactions, tableStates, tableTimeStatus } from "./lib/operations.mjs";
import { completeTour, feedbackCategories, feedbackIsValid, filterManualSections, isTourComplete, manualPdfPath, manualSections, resetTour, tourSteps } from "./lib/guidedSupport.mjs";
import { displayNewReportCount, feedbackDetailRows, reportStatusLabel } from "./lib/feedbackAdmin.mjs";
import "./styles.css";

const initialProducts = [
  { id: "p1", barcode: "8850124018015", name: "น้ำดื่ม", category: "เครื่องดื่ม", price: 15, stock: 48 },
  { id: "p2", barcode: "8851991601388", name: "โค้กกระป๋อง", category: "เครื่องดื่ม", price: 30, stock: 32 },
  { id: "p3", barcode: "8850332480213", name: "เลย์คลาสสิก", category: "ของทานเล่น", price: 35, stock: 18 },
  { id: "p4", barcode: "CS-CUE-TIP-01", name: "หัวคิว Master", category: "อุปกรณ์", price: 150, stock: 9 },
];
const initialMembers = [
  { id: "m1", name: "สมชาย ใจดี", phone: "081-234-5678", wallet: 500, points: 120 },
  { id: "m2", name: "วิชัย มั่นคง", phone: "089-876-5432", wallet: 250, points: 65 },
];
const formatMoney = (value) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(value || 0));
const persist = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const methodLabel = { promptpay: "PromptPay", cash: "เงินสด", wallet: "Wallet", card: "บัตร" };
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const navigation = [
  { id: "pos", label: "จุดขาย POS", icon: "▦" }, { id: "members", label: "สมาชิกและ Wallet", icon: "◉" }, { id: "booking", label: "จองโต๊ะและแจ้งเตือน", icon: "◷" }, { id: "inventory", label: "คลังและบาร์โค้ด", icon: "▤" }, { id: "console", label: "สถานะโต๊ะ", icon: "◌" }, { id: "history", label: "ประวัติรายการ", icon: "≡" }, { id: "settings", label: "การตั้งค่า", icon: "⚙" }, { id: "admin-feedback", label: "รายงานผู้ใช้", icon: "▣" },
];

function App() {
  const [view, setView] = useState("pos");
  const [products, setProducts] = useState(() => load("cs-products", initialProducts));
  const [members, setMembers] = useState(() => load("cs-members", initialMembers));
  const [cart, setCart] = useState([]);
  const [scanValue, setScanValue] = useState("");
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState(null);
  const [selectedMember, setSelectedMember] = useState("m1");
  const [topUp, setTopUp] = useState(100);
  const [booking, setBooking] = useState({ tableName: "โต๊ะ 03", customerName: "", phone: "", startTime: "19:00" });
  const [videoOpen, setVideoOpen] = useState(false);
  const [inventoryCode, setInventoryCode] = useState("");
  const [inventoryProductId, setInventoryProductId] = useState("");
  const [inventoryAction, setInventoryAction] = useState("receive");
  const [inventoryQuantity, setInventoryQuantity] = useState(1);
  const [tables, setTables] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({ from: "", to: "", method: "", query: "" });
  const [receipt, setReceipt] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptCustomer, setReceiptCustomer] = useState({ name: "ลูกค้าทั่วไป", email: "" });
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSearch, setHelpSearch] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ category: "problem", message: "", contact: "" });
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [adminReports, setAdminReports] = useState([]);
  const [adminFilters, setAdminFilters] = useState({ category: "", status: "" });
  const [adminKey, setAdminKey] = useState("");
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [newReportCount, setNewReportCount] = useState(0);
  const [reportNotes, setReportNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tableClock, setTableClock] = useState(() => new Date());
  const [integrationReadiness, setIntegrationReadiness] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => persist("cs-products", products), [products]);
  useEffect(() => persist("cs-members", members), [members]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const shownHistory = useMemo(() => clientFilterTransactions(history, historyFilters), [history, historyFilters]);
  const shiftSummary = useMemo(() => summarizeTransactions(shownHistory), [shownHistory]);
  const shownManualSections = useMemo(() => filterManualSections(manualSections, helpSearch), [helpSearch]);
  const tourPercent = Math.round(((tourIndex + 1) / tourSteps.length) * 100);
  const selectedReportRows = useMemo(() => selectedReport ? feedbackDetailRows(selectedReport, feedbackCategories.find((item) => item.value === selectedReport.category)?.label, navigation.find((item) => item.id === selectedReport.currentView)?.label) : [], [selectedReport]);

  async function loadTransactions() {
    const params = new URLSearchParams(Object.entries(historyFilters).filter(([, value]) => value));
    const response = await fetch(`/api/transactions?${params}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "ไม่สามารถโหลดประวัติได้");
    setHistory(result.transactions);
  }

  async function loadIntegrationReadiness() {
    try {
      const response = await fetch("/api/integrations/readiness");
      const result = await response.json();
      if (response.ok) setIntegrationReadiness(result.integrations || null);
    } catch { setIntegrationReadiness(null); }
  }

  useEffect(() => {
    loadTransactions().catch((error) => setNotice(error.message));
  }, [historyFilters.from, historyFilters.to, historyFilters.method, historyFilters.query]);

  useEffect(() => {
    fetch("/api/tables").then((response) => response.json()).then((result) => setTables(result.tables || [])).catch(() => setNotice("ไม่สามารถโหลดสถานะโต๊ะได้"));
    const stream = new EventSource("/api/tables/stream");
    stream.onmessage = (event) => { try { setTables(JSON.parse(event.data).tables || []); } catch { /* ignore incomplete event */ } };
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, []);
  useEffect(() => { loadIntegrationReadiness(); }, []);
  useEffect(() => { const timer = window.setInterval(() => setTableClock(new Date()), 30000); return () => window.clearInterval(timer); }, []);

  useEffect(() => { if (!isTourComplete(window.localStorage)) setTourOpen(true); }, []);
  useEffect(() => { if (view === "admin-feedback" && adminAuthorized) loadAdminFeedback(); }, [view, adminAuthorized, adminFilters.category, adminFilters.status]);
  useEffect(() => { if (!adminAuthorized) return undefined; loadNewFeedbackCount(); const timer = window.setInterval(loadNewFeedbackCount, 30000); return () => window.clearInterval(timer); }, [adminAuthorized]);
  useEffect(() => { if (selectedReport && adminAuthorized) { setReportNotes([]); setNoteDraft(""); setNoteStatus(null); loadInternalNotes(selectedReport.id); } }, [selectedReport?.id, adminAuthorized]);

  function addProduct(product) {
    if (product.stock <= 0) return setNotice("สินค้ารายการนี้หมดสต็อก");
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item) : [...current, { ...product, quantity: 1 }];
    });
    setNotice(`เพิ่ม ${product.name} ลงตะกร้าแล้ว`);
  }

  function handleScan(value = scanValue) {
    const code = value.trim();
    const product = findProductByBarcode(products, code);
    if (product) addProduct(product); else setNotice(`ไม่พบบาร์โค้ด: ${code || "-"}`);
    setScanValue("");
  }

  function updateStock(productId, delta) { setProducts((items) => applyStockAdjustment(items, productId, delta)); }

  function handleInventoryScan(value = inventoryCode) {
    const product = findProductByBarcode(products, value.trim());
    if (!product) return setNotice(`ไม่พบบาร์โค้ดในคลัง: ${value.trim() || "-"}`);
    setInventoryProductId(product.id); setInventoryCode("");
    setNotice(`พบสินค้า ${product.name} — เลือกการรับเข้าหรือปรับออก แล้วบันทึกจำนวน`);
  }

  function applyInventoryScan() {
    const quantity = Math.max(1, Number(inventoryQuantity) || 1);
    const product = products.find((item) => item.id === inventoryProductId);
    if (!product) return setNotice("กรุณาสแกนบาร์โค้ดหรือเลือกสินค้าก่อนทำรายการ");
    updateStock(product.id, inventoryAction === "receive" ? quantity : -quantity);
    setNotice(`${inventoryAction === "receive" ? "รับเข้า" : "ปรับออก"} ${product.name} จำนวน ${quantity} ชิ้นแล้ว`);
  }

  async function openQr(amount, purpose, onVerified, details = {}) {
    try {
      const response = await fetch("/api/payments/promptpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, purpose }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "สร้าง QR ไม่สำเร็จ");
      const imageUrl = await QRCode.toDataURL(data.payload, { width: 280, margin: 1, color: { dark: "#11342a", light: "#ffffff" } });
      setQr({ ...data, imageUrl, purpose, onVerified, details });
    } catch (error) { setNotice(error.message); }
  }

  async function confirmQr() {
    const response = await fetch(`/api/payments/${qr.reference}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: receiptCustomer.name, customerEmail: receiptCustomer.email, items: qr.details.items || [] }),
    });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error || "ยืนยันรายการไม่สำเร็จ");
    qr.onVerified?.();
    setReceipt(result.receipt); setReceiptEmail(result.receipt.customerEmail || receiptCustomer.email || "");
    setQr(null); setNotice("บันทึกการรับชำระเงินแล้ว และสร้างใบเสร็จพร้อมใช้งาน");
    loadTransactions().catch(() => {});
  }

  async function createBooking(event) {
    event.preventDefault();
    if (!booking.customerName || !booking.phone) return setNotice("กรุณากรอกชื่อลูกค้าและเบอร์โทรศัพท์");
    const response = await fetch("/api/notifications/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking) });
    const result = await response.json();
    setNotice(result.delivered ? "บันทึกการจองและส่ง LINE OA แล้ว" : "บันทึกการจองแล้ว — ตั้งค่า LINE OA เพื่อส่งแจ้งเตือนอัตโนมัติ");
    setBooking({ ...booking, customerName: "", phone: "" });
  }

  async function startCamera(onDetected = handleScan) {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) return setNotice("อุปกรณ์นี้ไม่รองรับการสแกนผ่านกล้อง โปรดใช้เครื่องสแกนหรือกรอกบาร์โค้ด");
    try {
      setVideoOpen(true); await new Promise((resolve) => setTimeout(resolve, 50));
      const video = videoRef.current;
      if (!video) throw new Error("ไม่สามารถเตรียมหน้าต่างกล้องได้");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream; await video.play();
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"] });
      const read = async () => {
        try {
          if (!videoRef.current?.srcObject) return;
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) { stopCamera(); onDetected(codes[0].rawValue); return; }
          requestAnimationFrame(read);
        } catch { stopCamera(); setNotice("ไม่สามารถอ่านบาร์โค้ดจากกล้องได้ โปรดกรอกรหัสหรือใช้เครื่องสแกน"); }
      };
      read();
    } catch (error) {
      stopCamera();
      setNotice(error?.name === "NotAllowedError" ? "ไม่ได้รับอนุญาตให้ใช้กล้อง โปรดอนุญาตการใช้กล้องหรือใช้เครื่องสแกน" : "ไม่สามารถเปิดกล้องได้ โปรดใช้เครื่องสแกนหรือกรอกรหัสบาร์โค้ด");
    }
  }

  function stopCamera() { const stream = videoRef.current?.srcObject; stream?.getTracks?.().forEach((track) => track.stop()); if (videoRef.current) videoRef.current.srcObject = null; setVideoOpen(false); }
  function checkout() { if (!cart.length) return setNotice("ยังไม่มีสินค้าในตะกร้า"); openQr(total, "pos", () => { setProducts((items) => items.map((product) => { const line = cart.find((item) => item.id === product.id); return line ? { ...product, stock: product.stock - line.quantity } : product; })); setCart([]); }, { items: cart }); }
  function walletTopUp() { const member = members.find((item) => item.id === selectedMember); openQr(topUp, "wallet", () => setMembers((items) => items.map((item) => item.id === selectedMember ? { ...item, wallet: item.wallet + Number(topUp) } : item)), { items: [{ name: `เติมเงิน Wallet: ${member?.name || "สมาชิก"}`, quantity: 1, price: Number(topUp) }] }); }
  async function changeTableStatus(table, status, updates = {}) {
    const response = await fetch(`/api/tables/${table.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, customerName: table.customerName, expectedEndAt: table.expectedEndAt, ...updates }) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error || "อัปเดตสถานะโต๊ะไม่สำเร็จ");
    setTables((current) => current.map((item) => item.id === result.table.id ? result.table : item));
    setNotice(`อัปเดต ${result.table.label} เป็นสถานะ ${tableStates[status].label} แล้ว`);
  }
  function openHistoryReceipt(record) { const item = { ...record, receiptNumber: record.receiptNumber || `R-${record.reference}` }; setReceipt(item); setReceiptEmail(item.customerEmail || ""); }
  async function sendReceiptEmail() {
    if (!receiptEmail) return setNotice("กรุณากรอกอีเมลลูกค้าก่อน");
    try {
      const response = await fetch(`/api/transactions/${encodeURIComponent(receipt.reference)}/receipt-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: receiptEmail }) });
      const result = await response.json();
      if (response.ok && result.delivered) return setNotice("ส่งใบเสร็จทางอีเมลจากระบบแล้ว");
      if (response.status !== 503) return setNotice(result.error || "ไม่สามารถส่งอีเมลใบเสร็จได้");
      window.location.href = receiptMailto({ ...receipt, customerEmail: receiptEmail });
      setNotice("ระบบส่งตรงยังไม่พร้อม จึงเปิดโปรแกรมอีเมลพร้อมข้อมูลใบเสร็จให้ตรวจสอบก่อนส่ง");
    } catch {
      setNotice("ไม่สามารถเชื่อมต่อบริการส่งอีเมลได้ โปรดลองใหม่อีกครั้ง");
    }
  }
  function startTour() { setHelpOpen(false); setTourIndex(0); setView(tourSteps[0].view); setTourOpen(true); }
  function restartTourFromHelp() { resetTour(window.localStorage); startTour(); }
  function advanceTour(direction) {
    const next = tourIndex + direction;
    if (next < 0) return;
    if (next >= tourSteps.length) { completeTour(window.localStorage); setTourOpen(false); return; }
    setTourIndex(next); setView(tourSteps[next].view);
  }
  function dismissTour() { completeTour(window.localStorage); setTourOpen(false); }
  function downloadManual() { const anchor = document.createElement("a"); anchor.href = manualPdfPath; anchor.download = "crazy-snooker-user-manual-th.pdf"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
  function exportShiftCsv() {
    const csv = `\ufeff${shiftSummaryCsv(shownHistory, methodLabel)}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crazy-snooker-shift-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setNotice(`ส่งออกสรุปกะ ${shiftSummary.count} รายการเป็น CSV แล้ว`);
  }
  function openFeedback() { setHelpOpen(false); setFeedbackStatus(null); setFeedbackOpen(true); }
  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedbackIsValid(feedbackForm.message)) return setFeedbackStatus({ kind: "error", message: "โปรดอธิบายรายละเอียดอย่างน้อย 10 ตัวอักษร" });
    setFeedbackStatus({ kind: "pending", message: "กำลังส่งข้อความ…" });
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...feedbackForm, currentView: view }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถส่งข้อความได้");
      setFeedbackStatus({ kind: "success", message: `${result.message} เลขอ้างอิง #${result.id}` });
      setFeedbackForm({ category: "problem", message: "", contact: "" });
      setNewReportCount((count) => count + 1);
    } catch (error) { setFeedbackStatus({ kind: "error", message: error.message || "ไม่สามารถส่งข้อความได้" }); }
  }
  async function loadAdminFeedback() {
    setAdminStatus("กำลังโหลดรายงาน…");
    try {
      const query = new URLSearchParams(Object.entries(adminFilters).filter(([, value]) => value));
      const response = await fetch(`/api/admin/feedback?${query}`, { headers: { "x-admin-key": adminKey } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถโหลดรายงานได้");
      setAdminReports(result.reports || []); setAdminStatus("");
    } catch (error) { if (String(error.message).includes("รหัสผู้ดูแล")) setAdminAuthorized(false); setAdminStatus(error.message || "ไม่สามารถโหลดรายงานได้"); }
  }
  async function loadNewFeedbackCount() {
    try {
      const response = await fetch("/api/admin/feedback/counts", { headers: { "x-admin-key": adminKey } });
      const result = await response.json();
      if (response.ok) setNewReportCount(Number(result.newCount || 0));
    } catch { /* badge refresh is non-blocking */ }
  }
  async function authorizeAdmin(event) {
    event.preventDefault(); setAdminStatus("กำลังตรวจสอบรหัส…");
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "x-admin-key": adminKey } });
      const result = await response.json();
      if (!response.ok || !result.authorized) throw new Error(result.error || "รหัสผู้ดูแลไม่ถูกต้อง");
      setAdminAuthorized(true); setAdminStatus(""); await loadNewFeedbackCount();
    } catch (error) { setAdminStatus(error.message || "รหัสผู้ดูแลไม่ถูกต้อง"); }
  }
  async function setReportStatus(report, status) {
    try {
      const response = await fetch(`/api/admin/feedback/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถอัปเดตสถานะได้");
      setAdminReports((reports) => reports.map((item) => item.id === report.id ? { ...item, status: result.report.status } : item));
      setSelectedReport((item) => item?.id === report.id ? { ...item, status: result.report.status } : item);
      setNotice(`อัปเดตรายงาน #${report.id} เป็น ${result.report.status} แล้ว`);
      loadNewFeedbackCount();
    } catch (error) { setAdminStatus(error.message || "ไม่สามารถอัปเดตสถานะได้"); }
  }
  async function loadInternalNotes(reportId) {
    try {
      const response = await fetch(`/api/admin/feedback/${reportId}/notes`, { headers: { "x-admin-key": adminKey } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถโหลดบันทึกภายในได้");
      setReportNotes(result.notes || []);
    } catch (error) { setNoteStatus({ kind: "error", message: error.message || "ไม่สามารถโหลดบันทึกภายในได้" }); }
  }
  async function submitInternalNote(event) {
    event.preventDefault();
    if (!selectedReport || noteDraft.trim().length < 2) return setNoteStatus({ kind: "error", message: "โปรดบันทึกข้อความอย่างน้อย 2 ตัวอักษร" });
    setNoteStatus({ kind: "pending", message: "กำลังบันทึก…" });
    try {
      const response = await fetch(`/api/admin/feedback/${selectedReport.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify({ noteBody: noteDraft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ไม่สามารถบันทึกหมายเหตุได้");
      setReportNotes((notes) => [result.note, ...notes]); setNoteDraft(""); setNoteStatus({ kind: "success", message: "บันทึกภายในแล้ว" });
    } catch (error) { setNoteStatus({ kind: "error", message: error.message || "ไม่สามารถบันทึกหมายเหตุได้" }); }
  }


  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-ball">8</span><div><b>CRAZY SNOOKER</b><small>CLUB CONTROL</small></div></div><nav>{navigation.map((item) => <button className={view === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => setView(item.id)} aria-label={item.id === "admin-feedback" && adminAuthorized && newReportCount ? `${item.label}, มีรายงานใหม่ ${newReportCount} รายการ` : item.label}><span>{item.icon}</span>{item.label}{item.id === "admin-feedback" && adminAuthorized && newReportCount > 0 && <b className="nav-badge" aria-hidden="true">{displayNewReportCount(newReportCount)}</b>}</button>)}</nav><div className="side-note">ระบบชำระเงินจะแสดงสถานะ<br />“รอตรวจสอบ” จนกว่าจะมีการยืนยัน</div></aside>
    <main className="main"><header><div><p className="eyebrow">OPERATIONS DASHBOARD</p><h1>{navigation.find((item) => item.id === view)?.label}</h1></div><div className="status"><i />กะปัจจุบันเปิดอยู่</div></header>{notice && <div className="notice">{notice}<button aria-label="ปิดข้อความ" onClick={() => setNotice("")}>×</button></div>}
      {view === "pos" && <section className="pos-layout"><div className="panel"><div className="panel-title"><div><h2>ขายสินค้า</h2><p>สแกนบาร์โค้ดหรือเลือกสินค้าเพื่อเพิ่มลงตะกร้า</p></div><button className="secondary" onClick={() => startCamera(handleScan)}>สแกนด้วยกล้อง</button></div><div className="scanner"><input aria-label="รหัสบาร์โค้ด" value={scanValue} placeholder="สแกนหรือพิมพ์รหัสบาร์โค้ด แล้วกด Enter" onChange={(event) => setScanValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleScan()} /><button onClick={() => handleScan()}>ค้นหา</button></div>{videoOpen && <div className="camera"><video ref={videoRef} muted playsInline /><button onClick={stopCamera}>ปิดกล้อง</button></div>}<div className="product-grid">{products.map((product) => <button className="product" key={product.id} onClick={() => addProduct(product)}><span className="product-category">{product.category}</span><b>{product.name}</b><small>{product.barcode}</small><strong>{formatMoney(product.price)}</strong><em>คงเหลือ {product.stock}</em></button>)}</div></div><aside className="panel cart"><div className="panel-title"><div><h2>ตะกร้า</h2><p>{cart.length} รายการสินค้า</p></div></div><div className="cart-lines">{cart.length ? cart.map((item) => <div className="cart-line" key={item.id}><div><b>{item.name}</b><span>{formatMoney(item.price)} × {item.quantity}</span></div><div><button onClick={() => setCart((items) => items.map((line) => line.id === item.id ? { ...line, quantity: Math.max(1, line.quantity - 1) } : line))}>−</button><button onClick={() => setCart((items) => items.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line))}>+</button></div></div>) : <p className="empty">ยังไม่มีสินค้าในตะกร้า</p>}</div><div className="total"><span>รวมยอด</span><b>{formatMoney(total)}</b></div><button className="primary" disabled={!cart.length} onClick={checkout}>สร้าง QR PromptPay</button><p className="hint">สแกน QR แล้วให้พนักงานตรวจสอบยอดก่อนกดยืนยันรับชำระ</p></aside></section>}
      {view === "members" && <section className="split"><div className="panel"><div className="panel-title"><div><h2>สมาชิก</h2><p>ยอดคงเหลือใน Wallet และคะแนนสะสม</p></div></div><div className="member-list">{members.map((member) => <button className={selectedMember === member.id ? "member selected" : "member"} key={member.id} onClick={() => setSelectedMember(member.id)}><span className="avatar">{member.name[0]}</span><div><b>{member.name}</b><small>{member.phone} · {member.points} คะแนน</small></div><strong>{formatMoney(member.wallet)}</strong></button>)}</div></div><div className="panel"><div className="panel-title"><div><h2>เติมเงินด้วย PromptPay</h2><p>ยอดเงินจะเข้ากระเป๋าเมื่อพนักงานยืนยันรับชำระ</p></div></div><label>สมาชิก<select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>จำนวนเงิน (บาท)<input type="number" min="1" value={topUp} onChange={(event) => setTopUp(event.target.value)} /></label><button className="primary" onClick={walletTopUp}>สร้าง QR เติมเงิน {formatMoney(topUp || 0)}</button></div></section>}
      {view === "booking" && <section className="split"><form className="panel" onSubmit={createBooking}><div className="panel-title"><div><h2>จองโต๊ะล่วงหน้า</h2><p>เมื่อบันทึก ระบบจะส่งข้อความเข้าสู่ LINE OA ที่กำหนด</p></div></div><label>โต๊ะ<select value={booking.tableName} onChange={(event) => setBooking({ ...booking, tableName: event.target.value })}><option>โต๊ะ 01 VIP</option><option>โต๊ะ 03</option><option>โต๊ะ 05</option></select></label><label>ชื่อลูกค้า<input value={booking.customerName} onChange={(event) => setBooking({ ...booking, customerName: event.target.value })} placeholder="ชื่อ-นามสกุล" /></label><label>โทรศัพท์<input value={booking.phone} onChange={(event) => setBooking({ ...booking, phone: event.target.value })} placeholder="08x-xxx-xxxx" /></label><label>เวลาเริ่มเล่น<input type="time" value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label><button className="primary" type="submit">บันทึกและแจ้ง LINE OA</button></form><div className="panel"><div className="panel-title"><div><h2>แจ้งเตือนก่อนหมดเวลา</h2><p>ระบบตรวจสอบโต๊ะทุก 1 นาทีหลังเผยแพร่ระบบ</p></div></div><div className="session-card"><span className="live">กำลังเล่น</span><h3>โต๊ะ 03</h3><p>คุณวิชัย · เหลือเวลา <b>8 นาที</b></p><button className="secondary" onClick={async () => { const response = await fetch("/api/notifications/near-end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableName: "โต๊ะ 03", remainingMinutes: 8 }) }); const result = await response.json(); setNotice(result.delivered ? "ส่งแจ้งเตือน LINE OA แล้ว" : "ทดสอบเงื่อนไขแจ้งเตือนแล้ว — ตั้งค่า LINE OA เพื่อส่งข้อความจริง"); }}>ทดสอบส่งแจ้งเตือน</button></div><p className="hint">การแจ้งเตือนอัตโนมัติทำงานผ่านงานกำหนดเวลาในระบบที่เผยแพร่ และป้องกันการส่งซ้ำต่อหนึ่งรอบเวลาเล่น</p></div></section>}
      {view === "inventory" && <section className="panel"><div className="panel-title"><div><h2>คลังสินค้าและบาร์โค้ด</h2><p>สแกนสินค้า แล้วระบุการรับเข้าหรือปรับออกก่อนบันทึกจำนวน</p></div><button className="secondary" onClick={() => startCamera(handleInventoryScan)}>สแกนด้วยกล้อง</button></div><div className="scanner"><input value={inventoryCode} placeholder="สแกนบาร์โค้ดเพื่อตรวจสอบสินค้า" onChange={(event) => setInventoryCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleInventoryScan()} /><button onClick={() => handleInventoryScan()}>ค้นหาสินค้า</button></div>{videoOpen && <div className="camera"><video ref={videoRef} muted playsInline /><button onClick={stopCamera}>ปิดกล้อง</button></div>}{inventoryProductId && <div className="inventory-action"><b>สินค้าที่สแกน: {products.find((item) => item.id === inventoryProductId)?.name}</b><label>รายการ<select value={inventoryAction} onChange={(event) => setInventoryAction(event.target.value)}><option value="receive">รับสินค้าเข้า</option><option value="adjust">ปรับสินค้าออก</option></select></label><label>จำนวน<input type="number" min="1" value={inventoryQuantity} onChange={(event) => setInventoryQuantity(event.target.value)} /></label><button className="secondary" onClick={applyInventoryScan}>บันทึกรายการจากบาร์โค้ด</button></div>}<div className="inventory-table"><div className="inventory-head"><span>สินค้า</span><span>บาร์โค้ด</span><span>คงเหลือ</span><span>ปรับจำนวน</span></div>{products.map((product) => <div className="inventory-row" key={product.id}><b>{product.name}<small>{product.category}</small></b><code>{product.barcode}</code><strong className={product.stock < 10 ? "low" : ""}>{product.stock}</strong><div><button onClick={() => updateStock(product.id, 1)}>+ รับเข้า</button><button onClick={() => updateStock(product.id, -1)}>− ปรับออก</button></div></div>)}</div></section>}
      {view === "console" && <section><div className="section-toolbar"><div><h2>สถานะโต๊ะแบบเรียลไทม์</h2><p>ข้อมูลจะอัปเดตทันทีในทุกหน้าจอที่เปิดระบบนี้อยู่</p></div><span className="realtime-pill"><i /> LIVE</span></div><div className="status-legend">{Object.entries(tableStates).map(([key, state]) => <span key={key}><i className={`legend-dot ${state.tone}`} />{state.label}</span>)}</div><div className="table-grid">{tables.map((table) => { const state = tableStates[table.status] || tableStates.maintenance; const timing = tableTimeStatus(table.expectedEndAt, tableClock); return <article className={`table-card ${state.tone}`} key={table.id}><div className="table-card-top"><span className={`table-state ${state.tone}`}>{state.label}</span><select aria-label={`สถานะ ${table.label}`} value={table.status} onChange={(event) => changeTableStatus(table, event.target.value)}>{Object.entries(tableStates).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div><h2>{table.label}</h2><b>{table.status === "occupied" ? timing.deadline : table.status === "reserved" ? "รอลูกค้า" : table.status === "available" ? "พร้อมใช้งาน" : "งดใช้งาน"}</b>{table.status === "occupied" && <><span className={`table-time-status ${timing.kind}`}>{timing.label}</span><label className="table-end-time">เวลาเลิกเล่น<input aria-label={`เวลาเลิกเล่น ${table.label}`} key={`${table.id}-${table.expectedEndAt}`} defaultValue={toDateTimeLocal(table.expectedEndAt)} type="datetime-local" onBlur={(event) => event.target.value && changeTableStatus(table, table.status, { expectedEndAt: event.target.value })} /></label></>}<p>{table.customerName || (table.status === "available" ? "เปิดให้รับลูกค้าใหม่" : "ไม่มีรายละเอียดลูกค้า")}</p><small>อัปเดต {formatDateTime(table.updatedAt)}</small></article>; })}</div></section>}
      {view === "history" && <section className="panel"><div className="panel-title"><div><h2>ประวัติการทำรายการ</h2><p>ค้นหารายการตามช่วงวันที่ ช่องทางชำระเงิน หรือเลขอ้างอิง</p></div><button className="secondary" onClick={() => loadTransactions().catch((error) => setNotice(error.message))}>รีเฟรช</button></div><div className="history-filters"><label>ตั้งแต่<input type="date" value={historyFilters.from} onChange={(event) => setHistoryFilters({ ...historyFilters, from: event.target.value })} /></label><label>ถึง<input type="date" value={historyFilters.to} onChange={(event) => setHistoryFilters({ ...historyFilters, to: event.target.value })} /></label><label>ชำระผ่าน<select value={historyFilters.method} onChange={(event) => setHistoryFilters({ ...historyFilters, method: event.target.value })}><option value="">ทุกช่องทาง</option>{Object.entries(methodLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>ค้นหา<input value={historyFilters.query} placeholder="เลขอ้างอิง ชื่อ หรืออีเมล" onChange={(event) => setHistoryFilters({ ...historyFilters, query: event.target.value })} /></label><button className="secondary" onClick={() => setHistoryFilters({ from: "", to: "", method: "", query: "" })}>ล้างตัวกรอง</button></div><div className="history-table"><div className="history-head"><span>รายการ</span><span>เวลา</span><span>วิธีชำระ</span><span>ยอดเงิน</span><span>ใบเสร็จ</span></div>{shownHistory.length ? shownHistory.map((record) => <div className="history-row" key={record.reference}><div><b>{record.reference}</b><small>{record.customerName || "ลูกค้าทั่วไป"}</small></div><span>{formatDateTime(record.paidAt || record.createdAt)}</span><span className={`method-chip ${record.paymentMethod}`}>{methodLabel[record.paymentMethod] || record.paymentMethod}</span><strong>{formatMoney(record.amount)}</strong><button className="secondary" onClick={() => openHistoryReceipt(record)}>เปิดใบเสร็จ</button></div>) : <p className="empty history-empty">ไม่พบรายการที่ตรงกับตัวกรอง</p>}</div></section>}
      {view === "settings" && <section className="split settings-layout"><div className="panel"><div className="panel-title"><div><h2>คู่มือและความช่วยเหลือ</h2><p>เปิดอ่านคู่มือฉบับย่อในระบบ หรือดาวน์โหลดคู่มือฉบับเต็มเป็น PDF</p></div></div><div className="settings-actions"><button className="primary" onClick={() => setHelpOpen(true)}>เปิดคู่มือการใช้งาน</button><button className="secondary" onClick={downloadManual}>ดาวน์โหลดคู่มือ PDF</button></div><p className="hint">ไฟล์ PDF มีเนื้อหาคู่มือฉบับเต็มสำหรับเก็บไว้ใช้งานหรือพิมพ์แจกพนักงาน</p></div><div className="panel"><div className="panel-title"><div><h2>แนะนำการใช้งาน</h2><p>เริ่มดูขั้นตอนสำคัญของระบบอีกครั้งได้ทุกเมื่อ</p></div></div><button className="primary" onClick={() => { resetTour(window.localStorage); startTour(); }}>เริ่ม Interactive Tour ใหม่</button><p className="hint">ทัวร์จะแสดงอัตโนมัติครั้งแรก และจะไม่แสดงซ้ำจนกว่าจะเลือกเริ่มใหม่</p></div></section>}
      {view === "admin-feedback" && <section className="panel admin-feedback">{!adminAuthorized ? <form className="admin-access" onSubmit={authorizeAdmin}><p className="eyebrow">INTERNAL ACCESS</p><h2>เข้าสู่ศูนย์รายงานผู้ใช้</h2><p>หน้านี้แสดงรายละเอียดและข้อมูลติดต่อจากรายงานผู้ใช้ กรุณากรอกรหัสผู้ดูแลระบบเพื่อดำเนินการต่อ</p><label>รหัสผู้ดูแลระบบ<input type="password" value={adminKey} autoComplete="current-password" onChange={(event) => setAdminKey(event.target.value)} placeholder="กรอกรหัสผู้ดูแล" /></label>{adminStatus && <p className="admin-status">{adminStatus}</p>}<button className="primary" type="submit">ปลดล็อกศูนย์รายงาน</button></form> : <><div className="panel-title"><div><h2>ศูนย์ติดตามรายงานผู้ใช้</h2><p>ตรวจสอบรายละเอียด จัดลำดับความสำคัญ และเปลี่ยนสถานะการดำเนินงานของรายงานที่ได้รับ</p></div><button className="secondary" onClick={loadAdminFeedback}>รีเฟรช</button></div><p className="admin-note">เปิดใช้สิทธิ์ผู้ดูแลในเซสชันนี้แล้ว ข้อมูลรายงานจะถูกเรียกผ่าน API ที่ต้องใช้รหัสผู้ดูแล</p><div className="admin-filters"><label>ประเภท<select value={adminFilters.category} onChange={(event) => setAdminFilters({ ...adminFilters, category: event.target.value })}><option value="">ทุกประเภท</option>{feedbackCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>สถานะ<select value={adminFilters.status} onChange={(event) => setAdminFilters({ ...adminFilters, status: event.target.value })}><option value="">ทุกสถานะ</option><option value="new">ใหม่</option><option value="in_progress">กำลังดำเนินการ</option><option value="resolved">แก้ไขแล้ว</option></select></label></div>{adminStatus && <p className="admin-status">{adminStatus}</p>}<div className="admin-report-list">{adminReports.length ? adminReports.map((report) => <article className="admin-report" key={report.id}><div className="admin-report-top"><span className={`report-status ${report.status}`}>{reportStatusLabel(report.status)}</span><small>#{report.id} · {formatDateTime(report.createdAt)}</small></div><h3>{feedbackCategories.find((item) => item.value === report.category)?.label || report.category}</h3><p>{report.message}</p><div className="admin-report-meta"><span>หน้าที่รายงาน: {navigation.find((item) => item.id === report.currentView)?.label || report.currentView}</span>{report.contact && <span>ติดต่อ: {report.contact}</span>}</div><div className="admin-report-actions"><button className="secondary" onClick={() => setSelectedReport(report)}>ดูรายละเอียด</button><select aria-label={`สถานะรายงาน ${report.id}`} value={report.status} onChange={(event) => setReportStatus(report, event.target.value)}><option value="new">ใหม่</option><option value="in_progress">กำลังดำเนินการ</option><option value="resolved">แก้ไขแล้ว</option></select></div></article>) : <div className="admin-empty"><b>ยังไม่มีรายงานตามตัวกรองนี้</b><p>เมื่อผู้ใช้ส่งปัญหาหรือข้อเสนอแนะ รายการจะแสดงที่นี่</p></div>}</div></>}</section>}
      {view === "settings" && <section className="panel integration-readiness"><div className="panel-title"><div><h2>ความพร้อมบริการ</h2><p>ตรวจสถานะการตั้งค่าโดยไม่แสดงข้อมูลลับและไม่ส่งธุรกรรม</p></div><button className="secondary" onClick={loadIntegrationReadiness}>ตรวจสอบอีกครั้ง</button></div>{integrationReadiness ? <div className="readiness-list">{Object.values(integrationReadiness).map((item) => <article key={item.label} className={item.ready ? "ready" : "not-ready"}><div><b>{item.label}</b><p>{item.message}</p></div><span>{item.ready ? "พร้อม" : "รอการตั้งค่า"}</span></article>)}</div> : <p className="hint">กำลังตรวจสอบสถานะบริการ…</p>}</section>}
      {view === "history" && <section className="panel shift-summary"><div className="panel-title"><div><h2>สรุปกะจากรายการที่แสดง</h2><p>ยอดและจำนวนด้านล่างจะเปลี่ยนตามตัวกรองในประวัติรายการ</p></div><div className="summary-actions"><button className="secondary" onClick={exportShiftCsv}>ส่งออก CSV</button><button className="secondary" onClick={() => window.print()}>พิมพ์สรุปกะ</button></div></div><div className="shift-summary-total"><span>รวม {shiftSummary.count} รายการ</span><b>{formatMoney(shiftSummary.total)}</b></div><div className="shift-methods">{Object.entries(shiftSummary.methods).length ? Object.entries(shiftSummary.methods).map(([method, value]) => <article key={method}><span>{methodLabel[method] || method}</span><b>{value.count} รายการ · {formatMoney(value.total)}</b></article>) : <p className="empty">ยังไม่มีรายการในช่วงหรือเงื่อนไขที่เลือก</p>}</div></section>}
    </main>
    <div className="help-fab-wrap"><button className="help-fab" aria-label="เปิดคู่มือการใช้งาน" aria-describedby="help-tooltip" onClick={() => setHelpOpen(true)}><span>?</span> ช่วยเหลือ</button><span id="help-tooltip" className="help-tooltip" role="tooltip">เปิดคู่มือ วิธีใช้งาน และรายงานปัญหา</span></div>
    {helpOpen && <div className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="modal-card help-card"><button className="close" aria-label="ปิดคู่มือ" onClick={() => setHelpOpen(false)}>×</button><p className="eyebrow">HELP CENTER</p><h2 id="help-title">คู่มือการใช้งาน</h2><p className="help-intro">ค้นหาหัวข้อที่ต้องการ หรือรายงานปัญหาที่พบขณะใช้งานได้ทันที</p><div className="help-toolbar"><label>ค้นหาหัวข้อ<input value={helpSearch} placeholder="เช่น บาร์โค้ด, ใบเสร็จ, QR" onChange={(event) => setHelpSearch(event.target.value)} /></label><button className="secondary" onClick={openFeedback}>รายงานปัญหา</button></div>{helpSearch && <p className="help-result-count">พบ {shownManualSections.length} หัวข้อที่ตรงกับ “{helpSearch}”</p>}<div className="help-sections">{shownManualSections.map((section) => <article key={section.id}><h3>{section.title}</h3><p>{section.body}</p></article>)}</div>{!shownManualSections.length && <div className="help-empty"><b>ไม่พบหัวข้อที่ค้นหา</b><p>ลองใช้คำค้นหาอื่น หรือเปิดดูคู่มือทุกหัวข้อ</p><button className="secondary" onClick={() => setHelpSearch("")}>ล้างคำค้นหา</button></div>}<div className="help-actions"><button className="secondary" onClick={restartTourFromHelp}>ดูการแนะนำการใช้งานอีกครั้ง</button><button className="primary" onClick={downloadManual}>ดาวน์โหลด PDF</button></div></div></div>}
    {feedbackOpen && <div className="modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><div className="modal-card feedback-card"><button className="close" aria-label="ปิดแบบฟอร์มรายงานปัญหา" onClick={() => setFeedbackOpen(false)}>×</button><p className="eyebrow">SUPPORT REPORT</p><h2 id="feedback-title">รายงานปัญหา / ส่งข้อเสนอแนะ</h2><p className="feedback-intro">กรุณาไม่ส่งรหัสผ่าน ข้อมูลบัตร หรือข้อมูลการชำระเงินในแบบฟอร์มนี้</p><form onSubmit={submitFeedback}><label>ประเภทข้อความ<select value={feedbackForm.category} onChange={(event) => setFeedbackForm({ ...feedbackForm, category: event.target.value })}>{feedbackCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>รายละเอียด<textarea value={feedbackForm.message} maxLength="2000" placeholder="อธิบายสิ่งที่พบ ขั้นตอนที่ทำ และสิ่งที่คาดหวัง" onChange={(event) => setFeedbackForm({ ...feedbackForm, message: event.target.value })} /></label><label>อีเมลหรือโทรศัพท์สำหรับติดต่อกลับ (ไม่บังคับ)<input value={feedbackForm.contact} maxLength="320" placeholder="example@club.com" onChange={(event) => setFeedbackForm({ ...feedbackForm, contact: event.target.value })} /></label><small>ระบบจะบันทึกว่าคุณรายงานจากหน้า {navigation.find((item) => item.id === view)?.label || view}</small>{feedbackStatus && <p className={`feedback-status ${feedbackStatus.kind}`}>{feedbackStatus.message}</p>}<button className="primary" disabled={feedbackStatus?.kind === "pending"} type="submit">{feedbackStatus?.kind === "pending" ? "กำลังส่ง…" : "ส่งข้อความ"}</button></form></div></div>}
    {tourOpen && <div className="modal tour-modal" role="dialog" aria-modal="true" aria-labelledby="tour-title"><div className="modal-card tour-card"><button className="close" aria-label="ข้ามการแนะนำ" onClick={dismissTour}>×</button><p className="eyebrow">FIRST-TIME GUIDE</p><div className="tour-progress-line"><span className="tour-progress">ขั้นตอน {tourIndex + 1} จาก {tourSteps.length}</span><b>{tourPercent}%</b></div><div className="tour-progress-bar" role="progressbar" aria-label="ความคืบหน้าระบบแนะนำการใช้งาน" aria-valuemin="0" aria-valuemax="100" aria-valuenow={tourPercent}><span style={{ width: `${tourPercent}%` }} /></div><h2 id="tour-title">{tourSteps[tourIndex].title}</h2><p>{tourSteps[tourIndex].body}</p><div className="tour-dots">{tourSteps.map((step, index) => <i className={index === tourIndex ? "active" : ""} key={step.id} />)}</div><div className="tour-actions"><button className="secondary" disabled={!tourIndex} onClick={() => advanceTour(-1)}>ย้อนกลับ</button><button className="secondary skip-tour" onClick={dismissTour}>ข้ามทัวร์ (Skip Tour)</button><button className="primary" onClick={() => advanceTour(1)}>{tourIndex === tourSteps.length - 1 ? "เริ่มใช้งาน" : "ถัดไป"}</button></div></div></div>}
    {selectedReport && <div className="modal report-detail-modal" role="dialog" aria-modal="true" aria-labelledby="report-detail-title"><div className="modal-card report-detail-card"><button className="close" aria-label="ปิดรายละเอียดรายงาน" onClick={() => setSelectedReport(null)}>×</button><p className="eyebrow">USER REPORT #{selectedReport.id}</p><h2 id="report-detail-title">{feedbackCategories.find((item) => item.value === selectedReport.category)?.label || selectedReport.category}</h2><p className="report-detail-message">{selectedReport.message}</p><dl>{selectedReportRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.label === "เวลาที่แจ้ง" ? formatDateTime(row.value) : row.value}</dd></div>)}</dl><section className="internal-notes"><div className="internal-notes-title"><div><h3>บันทึกภายใน</h3><p>เฉพาะผู้ดูแล ใช้ติดตามการตรวจสอบและการแก้ไข</p></div></div><form onSubmit={submitInternalNote}><label>เพิ่มบันทึกภายใน<textarea value={noteDraft} maxLength="2000" placeholder="เช่น ตรวจสอบข้อมูลแล้ว กำลังประสานงานกับพนักงาน…" onChange={(event) => setNoteDraft(event.target.value)} /></label>{noteStatus && <p className={`note-status ${noteStatus.kind}`}>{noteStatus.message}</p>}<button className="secondary" disabled={noteStatus?.kind === "pending"} type="submit">{noteStatus?.kind === "pending" ? "กำลังบันทึก…" : "บันทึกหมายเหตุ"}</button></form><div className="internal-note-list">{reportNotes.length ? reportNotes.map((note) => <article key={note.id}><p>{note.noteBody}</p><small>{note.authorContext} · {formatDateTime(note.createdAt)}</small></article>) : <p className="empty">ยังไม่มีบันทึกภายในสำหรับรายงานนี้</p>}</div></section><button className="primary" onClick={() => setSelectedReport(null)}>ปิดรายละเอียด</button></div></div>}
    {qr && <div className="modal"><div className="modal-card"><button className="close" onClick={() => setQr(null)}>×</button><p className="eyebrow">PROMPTPAY PAYMENT</p><h2>สแกนเพื่อชำระเงิน</h2><strong className="qr-amount">{formatMoney(qr.amount)}</strong><img src={qr.imageUrl} alt="PromptPay QR Code" /><code>{qr.reference}</code><p>สถานะ: <b className="pending">รอตรวจสอบ</b></p><label>ชื่อลูกค้าบนใบเสร็จ<input value={receiptCustomer.name} onChange={(event) => setReceiptCustomer({ ...receiptCustomer, name: event.target.value })} /></label><label>อีเมลสำหรับใบเสร็จ (ถ้ามี)<input type="email" value={receiptCustomer.email} onChange={(event) => setReceiptCustomer({ ...receiptCustomer, email: event.target.value })} /></label><button className="primary" onClick={confirmQr}>พนักงานยืนยันรับชำระแล้ว</button><small>QR นี้มีอายุ 15 นาที ระบบจะไม่บันทึกยอดเงินจนกว่าจะมีการยืนยัน</small></div></div>}
    {receipt && <div className="modal receipt-modal"><div className="modal-card receipt-print"><button className="close no-print" onClick={() => setReceipt(null)}>×</button><p className="eyebrow">PAYMENT RECEIPT</p><h2>ใบเสร็จรับเงิน</h2><div className="receipt-meta"><span>เลขที่: <b>{receipt.receiptNumber || `R-${receipt.reference}`}</b></span><span>{formatDateTime(receipt.issuedAt || receipt.paidAt || receipt.createdAt)}</span><span>ลูกค้า: {receipt.customerName || "ลูกค้าทั่วไป"}</span><span>ชำระผ่าน: {methodLabel[receipt.paymentMethod] || receipt.paymentMethod}</span></div><div className="receipt-lines">{(receipt.items || []).map((item, index) => <div key={`${item.name}-${index}`}><span>{item.name} × {item.quantity}</span><b>{formatMoney(item.price * item.quantity)}</b></div>)}</div><div className="receipt-total"><span>ยอดชำระ</span><b>{formatMoney(receipt.amount)}</b></div><label className="no-print">ส่งผ่านอีเมล<input type="email" placeholder="customer@example.com" value={receiptEmail} onChange={(event) => setReceiptEmail(event.target.value)} /></label><div className="receipt-actions no-print"><button className="secondary" onClick={() => window.print()}>พิมพ์ใบเสร็จ</button><button className="primary" onClick={sendReceiptEmail}>{integrationReadiness?.receiptEmail?.ready ? "ส่งใบเสร็จทางอีเมล" : "เตรียมอีเมลใบเสร็จ"}</button></div><small className="no-print">{integrationReadiness?.receiptEmail?.ready ? "ระบบจะส่งใบเสร็จจากเซิร์ฟเวอร์โดยตรงหลังตรวจสอบผู้รับ" : "ระบบส่งตรงยังไม่พร้อม จึงเปิดโปรแกรมอีเมลของพนักงานพร้อมข้อมูลใบเสร็จ เพื่อให้ตรวจสอบก่อนกดส่ง"}</small></div></div>}
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
