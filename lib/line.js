// Sends a LINE push message when a sale is completed.
// Requires LINE_CHANNEL_ACCESS_TOKEN and LINE_TARGET_ID env vars.
// Silently no-ops if not configured, so the app works fine without LINE set up.
export async function notifyLine(sale) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_ID;
  if (!token || !targetId) return;

  const d = new Date(sale.ts);
  const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const lines = sale.items
    .map((it) => `- ${it.name} x${it.qty} = ${it.price * it.qty}฿`)
    .join("\n");
  const payMethodTh = sale.payMethod === "cash" ? "เงินสด" : "โอนเงิน";

  const text =
    `🧺 บิลใหม่ - ${sale.employeeName || "ไม่ระบุ"}\n` +
    `เวลา ${timeStr}\n${lines}\n` +
    `รวม ${sale.total}฿ (${payMethodTh})`;

  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: "text", text }],
      }),
    });
  } catch (e) {
    // don't block the sale flow if LINE fails
  }
}
