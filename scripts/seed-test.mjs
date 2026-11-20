// Testdaten für das TEST-Projekt: löscht alles und legt einen festen,
// erfundenen Datenstand neu an. Beliebig oft ausführbar.
//
//   npm run seed:test
//
// Zugangsdaten nur lokal in .env.test.local (steht in .gitignore):
//   TEST_SUPABASE_URL=https://<test-ref>.supabase.co
//   TEST_SUPABASE_SECRET_KEY=sb_secret_...   (Secret key des TEST-Projekts)
//   TEST_ACCOUNT_PASSWORD=...                (mind. 8 Zeichen, für alle Testkonten)
//
// Schutz: Das Skript bricht ab, bevor es irgendetwas löscht, wenn die Tabelle
// public.test_environment_marker fehlt. Die gibt es nur im Test-Projekt, sie
// steht bewusst in keiner Migration. Gegen die echte Datenbank läuft es also
// nicht, selbst wenn dort versehentlich deren Schlüssel eingetragen wäre.

import { createClient } from "@supabase/supabase-js";

const ACCOUNT_EMAIL_DOMAIN = "accounts.translogpro.internal"; // wie lib/username.ts
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const BUCKET = "order-documents";

const url = process.env.TEST_SUPABASE_URL;
const secretKey = process.env.TEST_SUPABASE_SECRET_KEY;
const password = process.env.TEST_ACCOUNT_PASSWORD;

if (!url || !secretKey || !password) {
  fail(
    "TEST_SUPABASE_URL, TEST_SUPABASE_SECRET_KEY und TEST_ACCOUNT_PASSWORD müssen in .env.test.local stehen."
  );
}
if (password.length < 8) {
  fail("TEST_ACCOUNT_PASSWORD muss mindestens 8 Zeichen haben.");
}

const db = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function check(error, what) {
  if (error) fail(`${what}: ${error.message}`);
}

// Datum relativ zu heute als YYYY-MM-DD, damit die Testdaten nicht veralten.
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// --- 0. Schutz -----------------------------------------------------------------
async function assertTestProject() {
  const { error } = await db.from("test_environment_marker").select("*").limit(1);
  if (error) {
    fail(
      "Die Tabelle public.test_environment_marker fehlt. Das ist kein Test-Projekt " +
        "(oder sie wurde noch nicht angelegt). Es wurde nichts verändert."
    );
  }
}

// --- 1. Alles löschen ------------------------------------------------------------
async function wipe() {
  // Reihenfolge wegen der Fremdschlüssel: Rechnungen zuerst, weil
  // invoice_items Aufträge mit "on delete restrict" schützt.
  for (const table of [
    "invoices",
    "tank_entries",
    "orders",
    "external_orders",
    "trailers",
    "license_plates",
    "site_companies",
    "carrier_companies",
    "unloading_companies",
  ]) {
    const { error } = await db.from(table).delete().neq("id", NIL_UUID);
    check(error, `Löschen von ${table}`);
  }

  // Belege im Bucket: ein Ordner je Auftrag.
  const { data: folders, error: listError } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  check(listError, "Belege auflisten");
  for (const folder of folders ?? []) {
    const { data: files, error } = await db.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    check(error, `Belege in ${folder.name} auflisten`);
    const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await db.storage.from(BUCKET).remove(paths);
      check(removeError, `Belege in ${folder.name} löschen`);
    }
  }

  // Alle Konten. profiles und external_driver_accounts gehen per Cascade mit.
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    check(error, "Konten auflisten");
    if (data.users.length === 0) break;
    for (const user of data.users) {
      const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
      check(deleteError, `Konto ${user.email} löschen`);
    }
  }
}

// --- 2. Konten -------------------------------------------------------------------
async function createAccount(username, role, extra = {}) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${username}@${ACCOUNT_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { name: extra.name ?? username },
  });
  check(error, `Konto ${username} anlegen`);

  const { error: profileError } = await db
    .from("profiles")
    .insert({ id: data.user.id, role, license_plate: extra.licensePlate ?? null });
  check(profileError, `Profil ${username} anlegen`);

  return data.user.id;
}

// --- 3. Stammdaten und Bewegungsdaten ------------------------------------------
// defaultToNull: false — bei mehreren Zeilen mit unterschiedlichen Feldern
// bekämen fehlende Felder sonst null statt ihres Standardwerts.
async function insert(table, rows) {
  const { data, error } = await db.from(table).insert(rows, { defaultToNull: false }).select();
  check(error, `${table} anlegen`);
  return data;
}

async function seed() {
  const chef = await createAccount("testchef", "boss", { name: "Test Chef" });
  const fahrer1 = await createAccount("testfahrer1", "driver", {
    name: "Test Fahrer Eins",
    licensePlate: "GR 101 TE",
  });
  const fahrer2 = await createAccount("testfahrer2", "driver", {
    name: "Test Fahrer Zwei",
    licensePlate: "GR 102 TE",
  });

  const fremd = await createAccount("testfremd", "external_driver", { name: "Test Fremdfirma" });
  const { error: accessError } = await db.from("external_driver_accounts").insert({
    user_id: fremd,
    username: "testfremd",
    label: "Testfrächter Gamma GmbH",
    expires_on: day(60),
    password,
    created_by: chef,
  });
  check(accessError, "Fremdfahrer-Zugang anlegen");

  // LKW: einer mit fälligem Service, einer mit bald fälligem Pickerl.
  await insert("license_plates", [
    {
      name: "GR 101 TE",
      model: "Volvo FH 460",
      year_built: 2019,
      km_stand: 120000,
      km_entry_date: day(-10),
      service_interval_km: 60000,
      last_service_km: 70000,
      pickerl_due_date: day(20),
    },
    {
      name: "GR 102 TE",
      model: "MAN TGX 18.470",
      year_built: 2021,
      km_stand: 85000,
      km_entry_date: day(-10),
      service_interval_km: 60000,
      last_service_km: 20000,
      pickerl_due_date: day(200),
    },
  ]);

  const [trailer] = await insert("trailers", [
    { plate: "GR 501 TA", description: "Testauflieger Plane", pickerl_due_date: day(25) },
    { plate: "GR 502 TA", description: "Testauflieger Kühl", pickerl_due_date: day(300) },
  ]);
  await insert("trailer_permits", [
    { trailer_id: trailer.id, name: "Deutschland", valid_until: day(15), validity_years: 1 },
    { trailer_id: trailer.id, name: "Schweiz", valid_until: day(400), validity_years: 2 },
  ]);

  await insert("site_companies", [
    {
      name: "Testkunde Alpha GmbH",
      strasse: "Teststraße 1",
      plz: "8750",
      ort: "Judenburg",
      bmd_kto_nr: "T-20001",
      uid_nummer: "ATU00000001",
      zahlungsziel_tage: 30,
    },
    {
      name: "Testkunde Beta AG",
      strasse: "Musterweg 5",
      plz: "D-80331",
      ort: "München",
      bmd_kto_nr: "T-20002",
      uid_nummer: "DE000000002",
      zahlungsziel_tage: 45,
    },
    {
      name: "Testkunde Gamma KG",
      strasse: "Beispielgasse 9",
      plz: "8010",
      ort: "Graz",
      bmd_kto_nr: "T-20003",
      zahlungsziel_tage: 14,
      skonto_prozent: 2,
      skonto_tage: 7,
    },
  ]);
  await insert("carrier_companies", [
    { name: "Testfrächter Gamma GmbH", strasse: "Frachtweg 3", plz: "8700", ort: "Leoben" },
    { name: "Testfrächter Delta OG", strasse: "Ladestraße 7", plz: "9020", ort: "Klagenfurt" },
  ]);
  await insert("unloading_companies", [{ name: "Testlager Nord" }, { name: "Testlager Süd" }]);

  const route = {
    loading_company: "Testkunde Alpha GmbH",
    loading_address: "Teststraße 1, A-8750 Judenburg",
    unloading_company: "Testlager Nord",
    unloading_address: "Lagerplatz 2, D-80331 München",
    cargo_description: "Testware auf Paletten",
  };

  // Eigene Aufträge in jedem Status.
  const orders = await insert("orders", [
    { ...route, status: "pending", loading_date: day(2), unloading_date: day(3), reference_number: "TEST-REF-1" },
    { ...route, status: "assigned", assigned_to: fahrer1, loading_date: day(1), unloading_date: day(2) },
    { ...route, status: "in_progress", assigned_to: fahrer2, loading_date: day(0), unloading_date: day(1) },
    {
      ...route,
      status: "completed",
      assigned_to: fahrer1,
      license_plate: "GR 101 TE",
      loading_date: day(-5),
      unloading_date: day(-4),
      completed_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      start_odometer: 119000,
      loading_odometer: 119050,
      unloading_odometer: 119500,
      empty_km: 50,
      freight_km: 450,
      direction: "hin",
    },
    {
      ...route,
      status: "completed",
      assigned_to: fahrer2,
      license_plate: "GR 102 TE",
      cargo_type: "beilader",
      loading_date: day(-3),
      unloading_date: day(-2),
      completed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      direction: "her",
    },
  ]);
  const [, , , completedA, completedB] = orders;
  await insert("order_prices", [
    { order_id: completedA.id, preis: 1450 },
    { order_id: completedB.id, preis: 620 },
  ]);

  // Fremdaufträge: offen, dem Fremdfahrer zugewiesen, erledigt.
  const external = {
    ...route,
    recipient_company: "Testfrächter Gamma GmbH",
    recipient_address: "Frachtweg 3, A-8700 Leoben",
    freight_rate: "850,00",
    vehicle_type: "Sattelzug",
  };
  await insert("external_orders", [
    { ...external, loading_date: day(3), unloading_date: day(4) },
    {
      ...external,
      assigned_external_user_id: fremd,
      loading_date: day(1),
      unloading_date: day(2),
      customer_price: 1100,
    },
    {
      ...external,
      status: "completed",
      completed_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      loading_date: day(-7),
      unloading_date: day(-6),
      license_plate: "GR 999 FR",
      driver_name: "Fremder Testfahrer",
      customer_price: 990,
    },
  ]);

  // Tankungen. Der Trigger prüft Kennzeichen und km-Sprung wie in der App.
  await insert("tank_entries", [
    {
      driver_id: fahrer1,
      entry_date: day(-3),
      license_plate: "GR 101 TE",
      km_stand: 120400,
      liters_diesel: 412.5,
      liters_adblue: 30,
      fuel_station: "Testtankstelle Judenburg",
    },
    {
      driver_id: fahrer2,
      entry_date: day(-1),
      license_plate: "GR 102 TE",
      km_stand: 85600,
      liters_diesel: 380,
      fuel_station: "Testtankstelle Graz",
    },
  ]);

  // Eine Rechnung über den ersten erledigten Auftrag. Den Kopf füllt die
  // Edge Function export-invoice beim ersten Öffnen in der App vor.
  const { error: invoiceError } = await db.rpc("create_invoice", {
    p_order_ids: [completedA.id],
    p_jahr: new Date().getFullYear(),
  });
  check(invoiceError, "Rechnung anlegen");
}

await assertTestProject();
console.log("Test-Projekt erkannt. Lösche alle Daten …");
await wipe();
console.log("Lege Testdaten an …");
await seed();
console.log(`
✔ Testdaten angelegt.

Konten (Passwort jeweils TEST_ACCOUNT_PASSWORD aus .env.test.local):
  testchef      Chef
  testfahrer1   Fahrer, LKW GR 101 TE
  testfahrer2   Fahrer, LKW GR 102 TE
  testfremd     Fremdfahrer, gültig bis ${day(60)}
`);
