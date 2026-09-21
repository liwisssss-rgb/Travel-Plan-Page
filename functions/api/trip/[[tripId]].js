const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const table = { bills: "ledger_bills", travelers: "ledger_travelers", todos: "trip_todos", tickets: "trip_tickets" };
const safeId = (value) => String(value || "").trim().slice(0, 160);

// ------------------------------------------------------------------
// Seed data: Kk / Qz 买单，4 人分账，写入后由网站自动读取
// ------------------------------------------------------------------
const SEED_TRIP_ID = "thailand-uae-europe-2026";
const SEED_ORDERED_AT = "2026-09-21T11:00";
const SEED_CREATED_AT = "2026-09-21T11:00:00.000Z";
const SEED_UPDATED_AT = "2026-09-21T11:00:00.000Z";

const SEED_TRAVELERS = [
  { id: "person-kk", name: "Kk", color: "#D96C42" },
  { id: "person-qz", name: "Qz", color: "#217D91" },
  { id: "person-cb", name: "CB", color: "#5C8E62" },
  { id: "person-lt", name: "LT", color: "#8B6AA8" }
];

const SEED_PARTICIPANT_IDS = SEED_TRAVELERS.map((traveler) => traveler.id);

function makeSeedBill({ id, payerId, category, note, amountCents }) {
  return {
    id,
    originalAmountCents: amountCents,
    baseAmountCents: amountCents,
    currency: "CNY",
    category,
    note,
    orderedAt: SEED_ORDERED_AT,
    payerId,
    participantIds: SEED_PARTICIPANT_IDS,
    exchangeRate: 1,
    exchangeRateSource: "same-currency",
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_UPDATED_AT
  };
}

const SEED_BILLS = [
  // ---- Kk ----
  makeSeedBill({ id: "bill-kk-visa", payerId: "person-kk", category: "其他", note: "签证预约 153×4", amountCents: 61200 }),
  makeSeedBill({ id: "bill-kk-insurance", payerId: "person-kk", category: "其他", note: "保险", amountCents: 36000 }),
  makeSeedBill({ id: "bill-kk-louvre", payerId: "person-kk", category: "门票", note: "卢浮宫门票 422×2", amountCents: 84400 }),
  makeSeedBill({ id: "bill-kk-license", payerId: "person-kk", category: "其他", note: "驾照公证", amountCents: 79200 }),
  makeSeedBill({ id: "bill-kk-frankfurt-hotel", payerId: "person-kk", category: "住宿", note: "法兰克福酒店", amountCents: 74300 }),
  makeSeedBill({ id: "bill-kk-spiez-hotel", payerId: "person-kk", category: "住宿", note: "Spiez 酒店", amountCents: 662100 }),
  makeSeedBill({ id: "bill-kk-paris-hotel", payerId: "person-kk", category: "住宿", note: "Paris 酒店", amountCents: 810000 }),
  // ---- Qz ----
  makeSeedBill({ id: "bill-qz-sim", payerId: "person-qz", category: "其他", note: "流量卡", amountCents: 37200 }),
  makeSeedBill({ id: "bill-qz-flight-nkg-bkk", payerId: "person-qz", category: "交通", note: "机票 南京-曼谷", amountCents: 548400 }),
  makeSeedBill({ id: "bill-qz-flight-bkk-fra-1", payerId: "person-qz", category: "交通", note: "机票 曼谷-法兰克福（1）", amountCents: 409400 }),
  makeSeedBill({ id: "bill-qz-flight-bkk-fra-2", payerId: "person-qz", category: "交通", note: "机票 曼谷-法兰克福（2）", amountCents: 387600 }),
  makeSeedBill({ id: "bill-qz-flight-bru-pek", payerId: "person-qz", category: "交通", note: "机票 布鲁塞尔-北京", amountCents: 910300 }),
  makeSeedBill({ id: "bill-qz-rental", payerId: "person-qz", category: "交通", note: "租车 980.99 欧（按 7681 CNY 计）", amountCents: 768100 }),
  makeSeedBill({ id: "bill-qz-bangkok-hotel", payerId: "person-qz", category: "住宿", note: "曼谷酒店", amountCents: 257300 }),
  makeSeedBill({ id: "bill-qz-abudhabi-hotel", payerId: "person-qz", category: "住宿", note: "阿布扎比酒店", amountCents: 100000 }),
  makeSeedBill({ id: "bill-qz-grindelwald-hotel", payerId: "person-qz", category: "住宿", note: "Grindelwald 酒店", amountCents: 563100 }),
  makeSeedBill({ id: "bill-qz-brussels-hotel", payerId: "person-qz", category: "住宿", note: "Brussels 酒店", amountCents: 470800 })
];

function travelerInitial(name) {
  const characters = Array.from(String(name || "").trim());
  if (!characters.length) return "?";
  const latin = characters.find((character) => /[A-Za-z]/.test(character));
  return latin ? latin.toUpperCase() : characters[0].toUpperCase();
}

async function seedTrip(db, tripId) {
  const statements = [];
  for (const traveler of SEED_TRAVELERS) {
    const payload = JSON.stringify({
      id: traveler.id,
      name: traveler.name,
      initial: travelerInitial(traveler.name),
      color: traveler.color
    });
    statements.push(
      db.prepare(
        `INSERT INTO ledger_travelers (id, trip_id, created_at, updated_at, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(trip_id, id) DO NOTHING`
      ).bind(traveler.id, tripId, SEED_CREATED_AT, SEED_UPDATED_AT, payload)
    );
  }
  for (const bill of SEED_BILLS) {
    const payload = JSON.stringify(bill);
    statements.push(
      db.prepare(
        `INSERT INTO ledger_bills (id, trip_id, payer, amount, currency, category, note, participants, created_at, updated_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(trip_id, id) DO NOTHING`
      ).bind(
        bill.id,
        tripId,
        bill.payerId,
        bill.baseAmountCents,
        bill.currency,
        bill.category,
        bill.note,
        JSON.stringify(bill.participantIds),
        bill.createdAt,
        bill.updatedAt,
        payload
      )
    );
  }
  if (statements.length) await db.batch(statements);
}
// ------------------------------------------------------------------

async function readSnapshot(db, tripId, collections) {
  const snapshot = {
    version: 1,
    settings: null,
    bills: [],
    travelers: [],
    todos: [],
    tickets: [],
    updatedAt: new Date().toISOString()
  };
  await Promise.all(collections.map(async (collection) => {
    const result = await db.prepare(`SELECT payload FROM ${table[collection]} WHERE trip_id = ? ORDER BY created_at, id`).bind(tripId).all();
    snapshot[collection] = result.results.map((row) => JSON.parse(row.payload));
  }));
  return snapshot;
}

export async function onRequest(context) {
  const tripId = safeId(context.params.tripId);
  if (!tripId) return json({ error: "trip_id is required" }, 400);
  if (!context.env.DB) return json({ error: "D1 binding DB is missing" }, 500);
  const requested = new URL(context.request.url).searchParams.get("collections");
  const collections = [...new Set(String(requested || Object.keys(table).join(",")).split(",").filter((name) => table[name]))];
  if (!collections.length) return json({ error: "at least one valid collection is required" }, 400);
  try {
    if (context.request.method === "GET") {
      const snapshot = await readSnapshot(context.env.DB, tripId, collections);
      const billsEmpty = Array.isArray(snapshot.bills) && snapshot.bills.length === 0;
      if (tripId === SEED_TRIP_ID && collections.includes("bills") && billsEmpty) {
        await seedTrip(context.env.DB, tripId);
        return json(await readSnapshot(context.env.DB, tripId, collections));
      }
      return json(snapshot);
    }
    if (context.request.method !== "POST") return json({ error: "method not allowed" }, 405);
    const body = await context.request.json();
    if (!Array.isArray(body.changes)) return json({ error: "changes must be an array" }, 400);
    const statements = [];
    for (const change of body.changes) {
      const kind = table[change.collection];
      const id = safeId(change.id);
      if (!kind || !collections.includes(change.collection) || !id || !["upsert", "delete"].includes(change.op)) return json({ error: "invalid change" }, 400);
      if (change.op === "delete") {
        statements.push(context.env.DB.prepare(`DELETE FROM ${kind} WHERE trip_id = ? AND id = ?`).bind(tripId, id));
        continue;
      }
      const payload = JSON.stringify(change.value || {});
      const now = new Date().toISOString();
      if (change.collection === "bills") {
        const value = change.value || {};
        statements.push(context.env.DB.prepare(`INSERT INTO ledger_bills (id, trip_id, payer, amount, currency, category, note, participants, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(trip_id, id) DO UPDATE SET payer=excluded.payer, amount=excluded.amount, currency=excluded.currency, category=excluded.category, note=excluded.note, participants=excluded.participants, updated_at=excluded.updated_at, payload=excluded.payload`).bind(id, tripId, value.payerId || value.payer || "", Number(value.baseAmountCents ?? value.amount ?? 0), value.currency || "CNY", value.category || "其他", typeof value.note === "string" ? value.note.trim().slice(0, 160) : "", JSON.stringify(value.participantIds || value.participants || []), value.createdAt || now, value.updatedAt || now, payload));
      } else {
        statements.push(context.env.DB.prepare(`INSERT INTO ${kind} (id, trip_id, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?) ON CONFLICT(trip_id, id) DO UPDATE SET updated_at=excluded.updated_at, payload=excluded.payload`).bind(id, tripId, change.value?.createdAt || now, change.value?.updatedAt || now, payload));
      }
    }
    if (statements.length) await context.env.DB.batch(statements);
    return json(await readSnapshot(context.env.DB, tripId, collections));
  } catch (error) {
    return json({ error: "database operation failed", detail: error.message }, 500);
  }
}
