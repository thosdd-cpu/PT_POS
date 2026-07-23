"use client";
import React, { useEffect, useState } from "react";
import { theme } from "../../../lib/theme";
import { DEFAULT_SHOP_INFO } from "../../../lib/pricing";

function fmt(n) {
  return Math.round(n).toLocaleString("th-TH");
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function thaiDate(d) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PublicReceiptPage({ params }) {
  const [sale, setSale] = useState(null);
  const [shopInfo, setShopInfo] = useState(DEFAULT_SHOP_INFO);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    (async () => {
      try {
        const [saleRes, settingsRes] = await Promise.all([
          fetch(`/api/sales/${params.id}`).then((r) => r.json()),
          fetch("/api/settings").then((r) => r.json()),
        ]);
        if (saleRes.sale) {
          setSale(saleRes.sale);
          setStatus("ok");
        } else {
          setStatus("notfound");
        }
        if (settingsRes.settings) {
          setShopInfo({ shopName: settingsRes.settings.shopName, address: settingsRes.settings.address });
        }
      } catch (e) {
        setStatus("notfound");
      }
    })();
  }, [params.id]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.cream }}>
        <p style={{ color: "#5f5e5a" }}>กำลังโหลดใบเสร็จ...</p>
      </div>
    );
  }
  if (status === "notfound") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.cream, padding: 20 }}>
        <p style={{ color: "#888780", textAlign: "center" }}>ไม่พบใบเสร็จนี้</p>
      </div>
    );
  }

  const d = new Date(sale.ts);
  const hasPromo = sale.items.some((it) => it.promoApplied);
  const savings = sale.items.reduce((sum, it) => (it.promoApplied ? sum + (it.originalPrice - it.price) * it.qty : sum), 0);

  return (
    <div style={{ minHeight: "100vh", background: theme.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", width: 340, maxWidth: "100%", boxShadow: "0 8px 24px rgba(18,84,158,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <img src="/logo.png" alt="" style={{ width: 64, height: 64, margin: "0 auto 6px", display: "block", borderRadius: 12 }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{shopInfo.shopName}</p>
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}>
          <span>รวมทั้งสิ้น</span>
          <span>฿{fmt(sale.total)}</span>
        </div>
        <p style={{ fontSize: 12, color: "#5f5e5a", marginTop: 6 }}>
          ชำระโดย: {sale.payMethod === "cash" ? "เงินสด" : "QR Code"}
        </p>
        <div style={{ borderTop: "1px dashed #999", margin: "10px 0" }} />
        <p style={{ textAlign: "center", fontSize: 13, margin: 0 }}>ขอบพระคุณที่มาใช้บริการ</p>
        <p style={{ textAlign: "center", fontSize: 13, margin: "2px 0 0", fontWeight: 700 }}>{shopInfo.shopName}</p>
      </div>
    </div>
  );
}
