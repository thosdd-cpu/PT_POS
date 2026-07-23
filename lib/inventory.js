import { redis } from "./redis";

export const DEFAULT_INVENTORY = {
  washLiquidPerDay: 20,
  softenerPerDay: 20,
};

// Always key the daily reset off Bangkok time, regardless of the server's
// own timezone (Vercel functions run in UTC).
export function getBangkokDateKey(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // "YYYY-MM-DD"
}

async function getInventoryDefaults() {
  const raw = await redis.get("settings-v2");
  const settings = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  return settings?.inventory || DEFAULT_INVENTORY;
}

export async function getOrInitTodayInventory() {
  const dateKey = getBangkokDateKey();
  const key = `inventory:${dateKey}`;
  const raw = await redis.get(key);
  if (raw) {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { dateKey, ...data };
  }
  const defaults = await getInventoryDefaults();
  const fresh = {
    washLiquidRemaining: defaults.washLiquidPerDay,
    softenerRemaining: defaults.softenerPerDay,
    washLiquidPerDay: defaults.washLiquidPerDay,
    softenerPerDay: defaults.softenerPerDay,
  };
  await redis.set(key, JSON.stringify(fresh));
  return { dateKey, ...fresh };
}

export async function adjustInventory(kind, delta) {
  const current = await getOrInitTodayInventory();
  const field = kind === "softener" ? "softenerRemaining" : "washLiquidRemaining";
  const next = { ...current, [field]: Math.max(0, current[field] + delta) };
  delete next.dateKey;
  await redis.set(`inventory:${current.dateKey}`, JSON.stringify(next));
  return { dateKey: current.dateKey, ...next };
}

function liquidDelta(items) {
  let wash = 0;
  let softener = 0;
  for (const it of items || []) {
    if (it.category !== "liquid" || !it.liquidKind) continue;
    if (it.liquidKind === "wash") wash += it.qty;
    else if (it.liquidKind === "softener") softener += it.qty;
  }
  return { wash, softener };
}

// Called when a sale is created — subtracts sachets used from today's stock.
export async function decrementForSaleItems(items) {
  const { wash, softener } = liquidDelta(items);
  if (wash) await adjustInventory("wash", -wash);
  if (softener) await adjustInventory("softener", -softener);
}

// Called when a sale is deleted — gives the sachets back.
export async function restoreForSaleItems(items) {
  const { wash, softener } = liquidDelta(items);
  if (wash) await adjustInventory("wash", wash);
  if (softener) await adjustInventory("softener", softener);
}

// Called when a sale is edited — nets out the difference between the old
// and new item lists in one adjustment per liquid.
export async function applyEditDelta(oldItems, newItems) {
  const before = liquidDelta(oldItems);
  const after = liquidDelta(newItems);
  const washDelta = before.wash - after.wash; // positive = give back, negative = consume more
  const softenerDelta = before.softener - after.softener;
  if (washDelta) await adjustInventory("wash", washDelta);
  if (softenerDelta) await adjustInventory("softener", softenerDelta);
}
