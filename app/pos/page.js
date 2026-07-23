"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { theme, tempColors, dryerColors, addonColors, liquidColors, promoColors } from "../../lib/theme";
import { DEFAULT_PRICING, DEFAULT_SHOP_INFO } from "../../lib/pricing";

const PAY_CASH = "cash";
const PAY_QR = "transfer"; // kept as "transfer" internally for backward compatibility

function fmt(n) {
  return Math.round(n).toLocaleString("th-TH");
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thaiDate(d) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PosPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [view, setView] = useState("pos");
  const [shopInfo, setShopInfo] = useState(DEFAULT_SHOP_INFO);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [cart, setCart] = useState([]);
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [payMethod, setPayMethod] = useState(PAY_CASH);
  const [receipt, setReceipt] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [editingSale, setEditingSale] = useState(null);
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("session");
    if (!raw) { router.replace("/login"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role !== "staff") { router.replace("/login"); return; }
    setSession(parsed);
    setCheckedSession(true);
  }, [router]);

  useEffect(() => {
    if (!checkedSession) return;
    (async () => {
      try {
        const [settingsRes, salesRes, inventoryRes] = await Promise.all([
          fetch("/api/settings").then((r) => r.json()),
          fetch("/api/sales").then((r) => r.json()),
          fetch("/api/inventory").then((r) => r.json()),
        ]);
        if (settingsRes.settings) {
          if (settingsRes.settings.pricing) setPricing(settingsRes.settings.pricing);
          setShopInfo({ shopName: settingsRes.settings.shopName, address: settingsRes.settings.address });
        }
        if (salesRes.sales) setSales(salesRes.sales);
        if (inventoryRes.inventory) setInventory(inventoryRes.inventory);
      } catch (e) {
        showToast("โหลดข้อมูลไม่สำเร็จ ตรวจสอบการเชื่อมต่อ");
      }
      setLoading(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [checkedSession]);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory").then((r) => r.json());
      if (res.inventory) setInventory(res.inventory);
    } catch (e) {}
  }, []);

  const refreshSales = useCallback(async () => {
    try {
      const res = await fetch("/api/sales").then((r) => r.json());
      if (res.sales) setSales(res.sales);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!checkedSession) return;
    const interval = setInterval(() => {
      refreshSales();
      refreshInventory();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkedSession, refreshSales, refreshInventory]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  function logout() {
    sessionStorage.removeItem("session");
    router.replace("/login");
  }

  function addLine(line) {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === line.name && c.price === line.price);
      if (existing) return prev.map((c) => (c === existing ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...line, qty: 1 }];
    });
  }
  function changeQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + delta };
      if (next[idx].qty <= 0) next.splice(idx, 1);
      return next;
    });
  }
  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart]);

  async function completeSale() {
    if (cart.length === 0) { showToast("ยังไม่ได้เลือกรายการ"); return; }
    const now = new Date();
    const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
    const customerName = `คุณ${customerNameInput.trim()}`;
    const sale = {
      id, ts: now.getTime(), dateKey: toDateKey(now),
      items: cart, total, payMethod, employeeName: session?.name || "ไม่ระบุ", customerName,
    };
    setSales((prev) => [sale, ...prev]);
    setReceipt(sale);
    setCart([]);
    setCustomerNameInput("");
    setPayMethod(PAY_CASH);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sale),
      });
      if (!res.ok) throw new Error("save failed");
      refreshInventory();
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อ");
    }
  }

  async function saveEdit(updatedSale) {
    try {
      const res = await fetch(`/api/sales/${updatedSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSale),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? data.sale : s)));
      setEditingSale(null);
      showToast("บันทึกการแก้ไขแล้ว");
      refreshInventory();
    } catch (e) {
      showToast("แก้ไขไม่สำเร็จ");
    }
  }

  // Staff can only see today's sales — keeps yesterday's receipts locked from edits.
  const todaySales = useMemo(() => {
    const today = toDateKey(new Date());
    return sales.filter((s) => toDateKey(new Date(s.ts)) === today);
  }, [sales]);

  const todayStats = useMemo(() => {
    const cash = todaySales.filter((s) => s.payMethod === PAY_CASH).reduce((a, s) => a + s.total, 0);
    const qr = todaySales.filter((s) => s.payMethod === PAY_QR).reduce((a, s) => a + s.total, 0);
    return { cash, qr, total: cash + qr, count: todaySales.length };
  }, [todaySales]);

  function exportToExcel() {
    const rows = todaySales.map((s) => {
      const d = new Date(s.ts);
      return {
        "เวลา": timeStr(d),
        "ลูกค้า": s.customerName || "-",
        "พนักงาน": s.employeeName,
        "รายการ": s.items.map((it) => `${it.name} x${it.qty}`).join(", "),
        "วิธีชำระ": s.payMethod === PAY_CASH ? "เงินสด" : "QR Code",
        "ยอดรวม (บาท)": s.total,
      };
    });
    rows.push({});
    rows.push({ "เวลา": "สรุป", "รายการ": "เงินสด", "ยอดรวม (บาท)": todayStats.cash });
    rows.push({ "เวลา": "สรุป", "รายการ": "QR Code", "ยอดรวม (บาท)": todayStats.qr });
    rows.push({ "เวลา": "สรุป", "รายการ": "รวมทั้งหมด", "ยอดรวม (บาท)": todayStats.total });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ยอดขายวันนี้");
    XLSX.writeFile(wb, `ยอดขาย-${thaiDate(new Date())}.xlsx`);
  }

  if (!checkedSession || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.cream }}>
        <p style={{ color: "#5f5e5a" }}>กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.cream, paddingBottom: 40 }}>
      <Header shopName={shopInfo.shopName} employeeName={session?.name} view={view} setView={setView} logout={logout} />

      {toast && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", background: theme.navyDark, color: "#fff", padding: "8px 18px", borderRadius: 8, fontSize: 14, zIndex: 50 }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        {view === "pos" && (
          <PosView
            pricing={pricing}
            cart={cart}
            addLine={addLine}
            changeQty={changeQty}
            removeFromCart={removeFromCart}
            payMethod={payMethod}
            setPayMethod={setPayMethod}
            total={total}
            completeSale={completeSale}
            customerNameInput={customerNameInput}
            setCustomerNameInput={setCustomerNameInput}
            inventory={inventory}
            showToast={showToast}
          />
        )}
        {view === "reports" && (
          <TodayReportsView
            todaySales={todaySales}
            todayStats={todayStats}
            refreshSales={refreshSales}
            exportToExcel={exportToExcel}
            onEdit={(s) => setEditingSale(s)}
            onDownload={(s) => setReceipt(s)}
          />
        )}
      </div>

      {receipt && (
        <ReceiptModal sale={receipt} shopInfo={shopInfo} onClose={() => setReceipt(null)} />
      )}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          pricing={pricing}
          inventory={inventory}
          onCancel={() => setEditingSale(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

function Header({ shopName, employeeName, view, setView, logout }) {
  return (
    <div style={{ background: theme.navy, color: "#fff", padding: "14px 16px", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <img src="/logo.png" alt="" style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shopName}</p>
              <p style={{ margin: 0, fontSize: 12, color: theme.lightBlue }}>พนักงาน: {employeeName}</p>
            </div>
          </div>
          <button onClick={logout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
            ออกจากระบบ
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <TabButton active={view === "pos"} onClick={() => setView("pos")}>บันทึกรายการ</TabButton>
          <TabButton active={view === "reports"} onClick={() => setView("reports")}>รายงานยอดขายวันนี้</TabButton>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", background: active ? "#fff" : "rgba(255,255,255,0.12)", color: active ? theme.navy : "#fff" }}>
      {children}
    </button>
  );
}

function PayToggle({ payMethod, setPayMethod }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <PayButton active={payMethod === PAY_CASH} onClick={() => setPayMethod(PAY_CASH)} icon="ti-cash">เงินสด</PayButton>
      <PayButton active={payMethod === PAY_QR} onClick={() => setPayMethod(PAY_QR)} icon="ti-qrcode">QR Code</PayButton>
    </div>
  );
}

function PosView({ pricing, cart, addLine, changeQty, removeFromCart, payMethod, setPayMethod, total, completeSale, customerNameInput, setCustomerNameInput, inventory, showToast }) {
  function addLiquid(item) {
    const kind = item.id === "softener" ? "softener" : "wash";
    const remaining = kind === "softener" ? inventory?.softenerRemaining : inventory?.washLiquidRemaining;
    const reserved = cart.filter((c) => c.liquidKind === kind).reduce((sum, c) => sum + c.qty, 0);
    const available = remaining == null ? Infinity : remaining - reserved;
    if (available <= 0) {
      showToast(`${item.name}หมดสำหรับวันนี้ กรุณาแจ้งแอดมินเพื่อเพิ่มสต็อก`);
      return;
    }
    addLine({ name: item.name, price: item.price, category: "liquid", liquidKind: kind });
  }
  function addWasher(machine, option, usePromo) {
    const promoApplied = usePromo && !!option.promoPrice;
    const price = promoApplied ? option.promoPrice : option.normalPrice;
    addLine({ name: `${machine.name} - ${option.label}`, price, category: "washer", promoApplied, originalPrice: promoApplied ? option.normalPrice : null, temp: option.temp });
  }
  function addDryer(dryer, usePromo) {
    const promoApplied = usePromo && !!dryer.promoPrice;
    const price = promoApplied ? dryer.promoPrice : dryer.normalPrice;
    addLine({ name: dryer.name, price, category: "dryer", promoApplied, originalPrice: promoApplied ? dryer.normalPrice : null, dryerId: dryer.id });
  }
  function addAddon(minutes) { addLine({ name: `เพิ่มเวลาอบ ${minutes} นาที`, price: minutes, category: "addon", minutes }); }

  function availableFor(itemId) {
    const kind = itemId === "softener" ? "softener" : "wash";
    const remaining = kind === "softener" ? inventory?.softenerRemaining : inventory?.washLiquidRemaining;
    if (remaining == null) return null;
    const reserved = cart.filter((c) => c.liquidKind === kind).reduce((sum, c) => sum + c.qty, 0);
    return Math.max(0, remaining - reserved);
  }

  return (
    <div>
      <SectionCard title="ชื่อลูกค้า">
        <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #D3D1C7", borderRadius: 8, overflow: "hidden" }}>
          <span style={{ padding: "11px 12px", background: theme.lightBlue, color: theme.navyDark, fontWeight: 700, fontSize: 15 }}>คุณ</span>
          <input
            value={customerNameInput}
            onChange={(e) => setCustomerNameInput(e.target.value)}
            placeholder="ใส่ชื่อลูกค้า"
            style={{ flex: 1, border: "none", padding: "11px 12px", fontSize: 15, outline: "none" }}
          />
        </div>
      </SectionCard>

      {inventory && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <StockPill label="น้ำยาซักผ้า" remaining={inventory.washLiquidRemaining} perDay={inventory.washLiquidPerDay} />
          <StockPill label="น้ำยาปรับผ้านุ่ม" remaining={inventory.softenerRemaining} perDay={inventory.softenerPerDay} />
        </div>
      )}

      <SectionCard title="วิธีชำระเงิน">
        <PayToggle payMethod={payMethod} setPayMethod={setPayMethod} />
      </SectionCard>

      <SectionCard title="น้ำยา">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
          {pricing.liquids.map((it) => {
            const avail = availableFor(it.id);
            const outOfStock = avail !== null && avail <= 0;
            return (
              <PriceButton
                key={it.id}
                onClick={() => addLiquid(it)}
                name={it.name}
                price={outOfStock ? "หมดวันนี้ — แจ้งแอดมิน" : `฿${fmt(it.price)}/${it.unit}${avail !== null ? ` · เหลือ ${avail} ซอง` : ""}`}
                colors={liquidColors[it.id]}
                disabled={outOfStock}
              />
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="เครื่องซักผ้า">
        {pricing.washers.map((machine) => (
          <div key={machine.id} style={{ marginBottom: 10 }}>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 500, color: theme.ink }}>{machine.name}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
              {machine.options.map((opt) => (
                <React.Fragment key={opt.temp}>
                  <PriceButton
                    onClick={() => addWasher(machine, opt, false)}
                    name={opt.label}
                    price={`฿${fmt(opt.normalPrice)}`}
                    colors={tempColors[opt.temp]}
                  />
                  {opt.promoPrice != null && (
                    <PriceButton
                      onClick={() => addWasher(machine, opt, true)}
                      name={`${opt.label} (โปร)`}
                      price={`฿${fmt(opt.promoPrice)}`}
                      strike={`฿${fmt(opt.normalPrice)}`}
                      colors={promoColors}
                      promo
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="เครื่องอบผ้า">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
          {pricing.dryers.map((d) => (
            <React.Fragment key={d.id}>
              <PriceButton onClick={() => addDryer(d, false)} name={d.name} price={`฿${fmt(d.normalPrice)}`} colors={dryerColors[d.id]} />
              {d.promoPrice != null && (
                <PriceButton
                  onClick={() => addDryer(d, true)}
                  name={`${d.name} (โปร)`}
                  price={`฿${fmt(d.promoPrice)}`}
                  strike={`฿${fmt(d.normalPrice)}`}
                  colors={promoColors}
                  promo
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: "#5f5e5a" }}>เพิ่มเวลาอบ</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          {pricing.dryerAddons.map((m) => (
            <PriceButton key={m} onClick={() => addAddon(m)} name={`+${m} นาที`} price={`฿${fmt(m)}`} colors={addonColors[m]} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="รายการที่เลือก">
        <CartList cart={cart} changeQty={changeQty} removeFromCart={removeFromCart} />
      </SectionCard>

      <SectionCard title="วิธีชำระเงิน (ยืนยันอีกครั้ง)">
        <PayToggle payMethod={payMethod} setPayMethod={setPayMethod} />
      </SectionCard>

      <div style={{ position: "sticky", bottom: 12, marginTop: 16, background: "#fff", border: `1px solid ${theme.lightBlue}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 4px 16px rgba(18,84,158,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: "#5f5e5a" }}>ยอดรวม</span>
          <span style={{ fontSize: 26, fontWeight: 500, color: theme.navy }}>฿{fmt(total)}</span>
        </div>
        <button onClick={completeSale} style={{ width: "100%", padding: 13, borderRadius: 8, border: "none", background: theme.navy, color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
          บันทึกและออกใบเสร็จ
        </button>
      </div>
    </div>
  );
}

function StockPill({ label, remaining, perDay }) {
  const low = remaining === 0;
  return (
    <div style={{ flex: 1, background: low ? "#FBDCD3" : "#fff", border: `1px solid ${low ? theme.danger : theme.lightBlue}`, borderRadius: 10, padding: "8px 10px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "#888780" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: low ? theme.danger : theme.navy }}>{remaining} / {perDay} ซอง</p>
    </div>
  );
}

function CartList({ cart, changeQty, removeFromCart }) {
  if (cart.length === 0) {
    return <p style={{ color: "#888780", fontSize: 14, margin: "8px 0" }}>ยังไม่มีรายการ แตะรายการด้านบนเพื่อเพิ่ม</p>;
  }
  return cart.map((c, idx) => (
    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: idx < cart.length - 1 ? "0.5px solid #EEEDEA" : "none" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
          {c.name}
          {c.promoApplied && <span style={{ color: theme.goldDark, fontSize: 12, marginLeft: 6 }}>🎉 โปรโมชั่น</span>}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#888780" }}>
          ฿{fmt(c.price)} / ชิ้น
          {c.promoApplied && <span style={{ textDecoration: "line-through", marginLeft: 6 }}>฿{fmt(c.originalPrice)}</span>}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => changeQty(idx, -1)} style={stepBtn}>−</button>
        <span style={{ minWidth: 20, textAlign: "center", fontSize: 14 }}>{c.qty}</span>
        <button onClick={() => changeQty(idx, 1)} style={stepBtn}>+</button>
        <span style={{ fontSize: 14, fontWeight: 500, minWidth: 60, textAlign: "right" }}>฿{fmt(c.price * c.qty)}</span>
        <button onClick={() => removeFromCart(idx)} style={{ ...stepBtn, border: "none", color: theme.danger }}>
          <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
        </button>
      </div>
    </div>
  ));
}

function PriceButton({ onClick, name, price, strike, promo, colors, disabled }) {
  const c = colors || { bg: "#fff", border: "#D3D1C7", text: theme.ink };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        textAlign: "left", padding: 12, borderRadius: 12,
        border: `1.5px solid ${disabled ? "#D3D1C7" : c.border}`,
        background: disabled ? "#F1EFEA" : c.bg,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {promo && !disabled && (
        <span style={{ position: "absolute", top: -8, right: 8, background: theme.gold, color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 6 }}>โปร</span>
      )}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: disabled ? "#8A8A85" : c.text }}>{name}</p>
      <p style={{ margin: "4px 0 0", fontSize: 14 }}>
        <span style={{ color: disabled ? "#8A8A85" : c.text, fontWeight: promo ? 700 : 500 }}>{price}</span>
        {strike && <span style={{ textDecoration: "line-through", color: "#aaa", fontSize: 12, marginLeft: 6 }}>{strike}</span>}
      </p>
    </button>
  );
}

function PayButton({ active, onClick, children, icon }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: 12, borderRadius: 10, cursor: "pointer", border: active ? `2px solid ${theme.navy}` : "0.5px solid #D3D1C7", background: active ? theme.lightBlue : "#fff", color: active ? theme.navyDark : theme.ink, fontSize: 14, fontWeight: 500 }}>
      <i className={`ti ${icon}`} style={{ fontSize: 17, marginRight: 6, verticalAlign: -3 }} aria-hidden="true"></i>
      {children}
    </button>
  );
}

function ReceiptModal({ sale, shopInfo, onClose }) {
  const d = new Date(sale.ts);
  const hasPromo = sale.items.some((it) => it.promoApplied);
  const savings = sale.items.reduce((sum, it) => (it.promoApplied ? sum + (it.originalPrice - it.price) * it.qty : sum), 0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const receiptRef = useRef(null);

  useEffect(() => {
    const url = `${window.location.origin}/receipt/${sale.id}`;
    QRCode.toDataURL(url, { width: 120, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [sale.id]);

  async function saveAsJpeg() {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `ใบเสร็จ-${sale.id}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div ref={receiptRef} style={{ background: "#fff", borderRadius: 12, padding: "20px 18px", width: 320, maxWidth: "100%", overflowY: "auto", fontFamily: "'Noto Sans Thai', sans-serif" }}>
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <img src="/logo.png" alt="" style={{ width: 64, height: 64, margin: "0 auto 6px", display: "block" }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{shopInfo.shopName}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5f5e5a", lineHeight: 1.4 }}>{shopInfo.address}</p>
          </div>
          <div style={{ borderTop: "1px dashed #999", margin: "10px 0" }} />
          <p style={{ fontSize: 12, margin: "0 0 2px" }}>ลูกค้า: {sale.customerName || "คุณ"}</p>
          <p style={{ fontSize: 12, margin: "0 0 2px" }}>วันที่: {thaiDate(d)} {timeStr(d)} น.</p>
          <p style={{ fontSize: 12, margin: 0 }}>พนักงาน: {sale.employeeName}</p>
          <div style={{ borderTop: "1px dashed #999", margin: "10px 0" }} />
          {sale.items.map((it, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{it.name} x{it.qty}</span>
                <span>฿{fmt(it.price * it.qty)}</span>
              </div>
              {(it.category === "washer" || it.category === "dryer") && (
                <p style={{ margin: "1px 0 0", fontSize: 10, color: it.promoApplied ? theme.goldDark : "#999" }}>
                  {it.promoApplied ? `🎉 ใช้โปรโมชั่น (ราคาปกติ ฿${fmt(it.originalPrice)})` : "ไม่มีโปรโมชั่น"}
                </p>
              )}
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #999", margin: "10px 0" }} />
          {hasPromo && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.goldDark, marginBottom: 4 }}>
              <span>ประหยัดจากโปรโมชั่น</span>
              <span>฿{fmt(savings)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700 }}>
            <span>รวมทั้งสิ้น</span>
            <span>฿{fmt(sale.total)}</span>
          </div>
          <p style={{ fontSize: 12, color: "#5f5e5a", marginTop: 6 }}>ชำระโดย: {sale.payMethod === PAY_CASH ? "เงินสด" : "QR Code"}</p>
          <div style={{ borderTop: "1px dashed #999", margin: "10px 0" }} />
          <p style={{ textAlign: "center", fontSize: 13, margin: 0 }}>ขอบพระคุณที่มาใช้บริการ</p>
          <p style={{ textAlign: "center", fontSize: 13, margin: "2px 0 0", fontWeight: 700 }}>{shopInfo.shopName}</p>
          {qrDataUrl && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <img src={qrDataUrl} alt="สแกนดูใบเสร็จออนไลน์" style={{ width: 100, height: 100, margin: "0 auto" }} />
              <p style={{ fontSize: 10, color: "#888780", margin: "4px 0 0" }}>สแกนเพื่อดูใบเสร็จออนไลน์</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={saveAsJpeg} style={{ ...ghostBtnSm, flex: 1, padding: 10, background: "#fff" }}>
            <i className="ti ti-download" style={{ marginRight: 6 }} aria-hidden="true"></i>บันทึกเป็น JPEG
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: theme.navy, color: "#fff", fontWeight: 500, cursor: "pointer" }}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

function EditSaleModal({ sale, pricing, inventory, onCancel, onSave }) {
  const [cart, setCart] = useState(sale.items);
  const [payMethod, setPayMethod] = useState(sale.payMethod);
  const [customerNameInput, setCustomerNameInput] = useState((sale.customerName || "คุณ").replace(/^คุณ/, ""));
  const originalQty = useRef(
    sale.items.reduce((acc, it) => {
      if (it.category === "liquid" && it.liquidKind) acc[it.liquidKind] = (acc[it.liquidKind] || 0) + it.qty;
      return acc;
    }, {})
  ).current;

  function addLine(line) {
    setCart((prev) => {
      const existing = prev.find((c) => c.name === line.name && c.price === line.price);
      if (existing) return prev.map((c) => (c === existing ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { ...line, qty: 1 }];
    });
  }
  function changeQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + delta };
      if (next[idx].qty <= 0) next.splice(idx, 1);
      return next;
    });
  }
  function removeFromCart(idx) { setCart((prev) => prev.filter((_, i) => i !== idx)); }

  function availableFor(itemId) {
    const kind = itemId === "softener" ? "softener" : "wash";
    const remaining = kind === "softener" ? inventory?.softenerRemaining : inventory?.washLiquidRemaining;
    if (remaining == null) return null;
    const currentQty = cart.filter((c) => c.liquidKind === kind).reduce((sum, c) => sum + c.qty, 0);
    const room = remaining + (originalQty[kind] || 0);
    return Math.max(0, room - currentQty);
  }

  function addLiquid(item) {
    const kind = item.id === "softener" ? "softener" : "wash";
    const avail = availableFor(item.id);
    if (avail !== null && avail <= 0) return;
    addLine({ name: item.name, price: item.price, category: "liquid", liquidKind: kind });
  }
  function addWasher(machine, option, usePromo) {
    const promoApplied = usePromo && !!option.promoPrice;
    const price = promoApplied ? option.promoPrice : option.normalPrice;
    addLine({ name: `${machine.name} - ${option.label}`, price, category: "washer", promoApplied, originalPrice: promoApplied ? option.normalPrice : null });
  }
  function addDryer(dryer, usePromo) {
    const promoApplied = usePromo && !!dryer.promoPrice;
    const price = promoApplied ? dryer.promoPrice : dryer.normalPrice;
    addLine({ name: dryer.name, price, category: "dryer", promoApplied, originalPrice: promoApplied ? dryer.normalPrice : null });
  }
  function addAddon(minutes) { addLine({ name: `เพิ่มเวลาอบ ${minutes} นาที`, price: minutes, category: "addon" }); }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  function handleSave() {
    onSave({ ...sale, items: cart, total, payMethod, customerName: `คุณ${customerNameInput.trim()}` });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: theme.cream, borderRadius: 12, padding: 16, width: 420, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 12px", color: theme.ink }}>แก้ไขรายการ</h3>

        <SectionCard title="ชื่อลูกค้า">
          <div style={{ display: "flex", border: "1px solid #D3D1C7", borderRadius: 8, overflow: "hidden" }}>
            <span style={{ padding: "9px 10px", background: theme.lightBlue, fontWeight: 700 }}>คุณ</span>
            <input value={customerNameInput} onChange={(e) => setCustomerNameInput(e.target.value)} style={{ flex: 1, border: "none", padding: "9px 10px", outline: "none" }} />
          </div>
        </SectionCard>

        <SectionCard title="น้ำยา">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
            {pricing.liquids.map((it) => {
              const avail = availableFor(it.id);
              const outOfStock = avail !== null && avail <= 0;
              return (
                <PriceButton
                  key={it.id}
                  onClick={() => addLiquid(it)}
                  name={it.name}
                  price={outOfStock ? "หมดวันนี้" : `฿${fmt(it.price)}${avail !== null ? ` · เหลือ ${avail}` : ""}`}
                  colors={liquidColors[it.id]}
                  disabled={outOfStock}
                />
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="เครื่องซัก/อบ">
          {pricing.washers.map((machine) => (
            <div key={machine.id} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 8 }}>
              {machine.options.map((opt) => (
                <React.Fragment key={opt.temp}>
                  <PriceButton onClick={() => addWasher(machine, opt, false)} name={`${machine.name.split("(")[1]?.replace(")", "") || ""} ${opt.label}`} price={`฿${fmt(opt.normalPrice)}`} colors={tempColors[opt.temp]} />
                  {opt.promoPrice != null && (
                    <PriceButton onClick={() => addWasher(machine, opt, true)} name={`${opt.label} โปร`} price={`฿${fmt(opt.promoPrice)}`} colors={promoColors} promo />
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
          {pricing.dryers.map((d) => (
            <div key={d.id} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 8 }}>
              <PriceButton onClick={() => addDryer(d, false)} name={d.name} price={`฿${fmt(d.normalPrice)}`} colors={dryerColors[d.id]} />
              {d.promoPrice != null && (
                <PriceButton onClick={() => addDryer(d, true)} name={`${d.name} โปร`} price={`฿${fmt(d.promoPrice)}`} colors={promoColors} promo />
              )}
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            {pricing.dryerAddons.map((m) => (
              <PriceButton key={m} onClick={() => addAddon(m)} name={`+${m} นาที`} price={`฿${fmt(m)}`} colors={addonColors[m]} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="รายการ">
          <CartList cart={cart} changeQty={changeQty} removeFromCart={removeFromCart} />
        </SectionCard>

        <SectionCard title="วิธีชำระเงิน">
          <PayToggle payMethod={payMethod} setPayMethod={setPayMethod} />
        </SectionCard>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: "#5f5e5a" }}>ยอดรวมใหม่</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: theme.navy }}>฿{fmt(total)}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...ghostBtnSm, flex: 1, padding: 10 }}>ยกเลิก</button>
          <button onClick={handleSave} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: theme.navy, color: "#fff", fontWeight: 500, cursor: "pointer" }}>บันทึกการแก้ไข</button>
        </div>
      </div>
    </div>
  );
}

function TodayReportsView({ todaySales, todayStats, refreshSales, exportToExcel, onEdit, onDownload }) {
  return (
    <div>
      <SectionCard title={`วันนี้ · ${thaiDate(new Date())}`} action={
        <button onClick={refreshSales} style={ghostBtnSm}><i className="ti ti-refresh" style={{ fontSize: 15, marginRight: 4 }} aria-hidden="true"></i>รีเฟรช</button>
      }>
        <p style={{ fontSize: 12, color: "#888780", margin: 0 }}>พนักงานดูรายงานได้เฉพาะวันนี้เท่านั้น เพื่อป้องกันการแก้ไขใบเสร็จของวันก่อนหน้า</p>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
        <MetricCard label="ยอดรวมวันนี้" value={`฿${fmt(todayStats.total)}`} />
        <MetricCard label="จำนวนบิล" value={todayStats.count} />
        <MetricCard label="เงินสด" value={`฿${fmt(todayStats.cash)}`} />
        <MetricCard label="QR Code" value={`฿${fmt(todayStats.qr)}`} />
      </div>

      <SectionCard title={`รายการ (${todaySales.length})`} action={
        todaySales.length > 0 && <button onClick={exportToExcel} style={ghostBtnSm}><i className="ti ti-download" style={{ fontSize: 15, marginRight: 4 }} aria-hidden="true"></i>Excel</button>
      }>
        {todaySales.length === 0 ? (
          <p style={{ color: "#888780", fontSize: 14 }}>ยังไม่มีรายการขายวันนี้</p>
        ) : (
          todaySales.map((s) => {
            const d = new Date(s.ts);
            return (
              <div key={s.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #EEEDEA" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: theme.ink }}>
                      {timeStr(d)} · {s.customerName || "คุณ"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "#5f5e5a", lineHeight: 1.5 }}>
                      {s.items.map((it) => `${it.name}x${it.qty}`).join(", ")}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: s.payMethod === PAY_CASH ? theme.navy : theme.goldDark, fontWeight: 500 }}>
                      {s.payMethod === PAY_CASH ? "เงินสด" : "QR Code"}
                    </p>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: theme.navy, whiteSpace: "nowrap" }}>฿{fmt(s.total)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => onEdit(s)} style={{ ...ghostBtnSm, flex: 1 }}>
                    <i className="ti ti-edit" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true"></i>แก้ไข
                  </button>
                  <button onClick={() => onDownload(s)} style={{ ...ghostBtnSm, flex: 1 }}>
                    <i className="ti ti-download" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true"></i>ดาวน์โหลดใบเสร็จ
                  </button>
                </div>
              </div>
            );
          })
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${theme.lightBlue}`, borderRadius: 12, padding: "12px 14px" }}>
      <p style={{ margin: 0, fontSize: 12, color: "#888780" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 500, color: theme.navy }}>{value}</p>
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${theme.lightBlue}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: theme.ink }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const ghostBtnSm = { padding: "8px 12px", borderRadius: 8, border: "1px solid #B4B2A9", background: "#fff", fontSize: 13, cursor: "pointer", color: "#2C2C2A", whiteSpace: "nowrap" };
const stepBtn = { width: 28, height: 28, borderRadius: 6, border: "0.5px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" };
