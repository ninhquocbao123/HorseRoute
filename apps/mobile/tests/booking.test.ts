import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactAddress,
  draftFromOrder,
  estimateInput,
  insuranceForBreeds,
  migrateOldDraft,
  newDraft,
  normalizeSearch,
  orderBody,
  setRoute,
  setTripType,
  stepErrors,
  withVehicleFor,
  type BookingContact,
} from "../src/booking-domain.ts";

const account = { fullName: "Khách Minh", phone: "0912345678", address: "1 Lê Lợi" };
const contact: BookingContact = {
  name: "Anh Ba",
  phone: "0901 234.567",
  address: "Trại Ba Vì",
  city: "Hà Nội",
  ward: "Ba Vì",
  identityNumber: "012345678901",
  country: "VN",
};
const filled = () => {
  const d = newDraft("r1", account, ["1"]);
  return {
    ...d,
    date: "2026-12-01",
    booking: { ...d.booking, sender: { ...contact }, recipient: { ...contact, name: "Chị Tư" } },
  };
};
const profile = (id: string, passportNo = `P-${id}`) =>
  ({ id, name: `Ngựa ${id}`, passportNo, breed: "Arabian", birthDate: "", sex: "", coatColor: "", note: "" }) as any;

test("new draft starts with an empty sender until the customer taps 'Tôi là người gửi' (like the web)", () => {
  const d = newDraft("r1", account);
  assert.equal(d.booking.sender.name, "");
  assert.equal(d.booking.sender.phone, "");
  assert.equal(d.booking.sender.country, "VN");
  assert.equal(d.booking.recipient.name, "");
  assert.equal(d.booking.paymentMethod, "BANK");
});
test("order address joins specific address, ward and city in web format", () => {
  assert.equal(contactAddress(contact), "Trại Ba Vì, Ba Vì, Hà Nội");
});
test("search ignores Vietnamese marks", () => {
  assert.equal(normalizeSearch(" Hà Nội "), "ha noi");
  assert.equal(normalizeSearch("Đà Lạt"), "da lat");
});
test("trip type and route allow only VN with CN or TH, and clear places on change", () => {
  const d = filled();
  const abroad = setTripType(d, true);
  assert.equal(abroad.booking.sender.country, "VN");
  assert.equal(abroad.booking.sender.city, "Hà Nội");
  assert.equal(abroad.booking.recipient.country, "CN");
  assert.equal(abroad.booking.recipient.city, "");
  const back = setRoute(abroad, "TH", "VN");
  assert.equal(back.booking.sender.country, "TH");
  assert.equal(back.booking.sender.ward, "");
  // Tuyến không hỗ trợ thì giữ nguyên.
  assert.equal(setRoute(abroad, "CN", "TH"), abroad);
  assert.equal(setRoute(abroad, "VN", "KH"), abroad);
  assert.equal(setTripType(abroad, false).booking.recipient.country, "VN");
});
test("vehicle grows to the smallest class that fits, and never shrinks by itself", () => {
  const d = newDraft("r1", account);
  assert.equal(withVehicleFor(1, d).booking.vehicleCapacity, 2);
  assert.equal(withVehicleFor(3, d).booking.vehicleCapacity, 4);
  assert.equal(withVehicleFor(3, d).booking.vehicleClass, "MEDIUM");
  assert.equal(withVehicleFor(7, d).booking.vehicleCapacity, 9);
  assert.equal(withVehicleFor(1, withVehicleFor(7, d)).booking.vehicleCapacity, 9);
});
test("insurance group follows the breed only when the whole group matches", () => {
  assert.equal(insuranceForBreeds(["Arabian", "arabian"]), "ARABIAN");
  assert.equal(insuranceForBreeds(["Quarter Horse"]), "QUARTER_HORSE");
  assert.equal(insuranceForBreeds(["Arabian", "Warmblood"]), "OTHER");
  assert.equal(insuranceForBreeds([]), "OTHER");
});
test("step 1 requires every contact field and a date from today", () => {
  const empty = newDraft("r1", account);
  const e = stepErrors(0, empty, "2026-11-06");
  for (const field of ["date", "sender.name", "sender.phone", "sender.city", "sender.ward", "sender.identityNumber", "recipient.name", "recipient.phone", "recipient.address"])
    assert.ok(e[field], field);
  assert.deepEqual(stepErrors(0, filled(), "2026-11-06"), {});
  assert.ok(stepErrors(0, { ...filled(), date: "2026-11-05" }, "2026-11-06").date);
  const badPhone = filled();
  badPhone.booking.recipient.phone = "123";
  assert.ok(stepErrors(0, badPhone, "2026-11-06")["recipient.phone"]);
});
test("step 2 needs horses within vehicle capacity", () => {
  assert.ok(stepErrors(1, { ...filled(), selected: [] }, "2026-11-06").horses);
  assert.ok(stepErrors(1, { ...filled(), selected: ["1", "2", "3"] }, "2026-11-06").vehicle);
  assert.ok(stepErrors(1, { ...filled(), selected: "1234567890".split("") }, "2026-11-06").horses);
  assert.deepEqual(stepErrors(1, filled(), "2026-11-06"), {});
});
test("step 4 needs the terms", () => {
  assert.ok(stepErrors(3, filled(), "2026-11-06").terms);
  const d = filled();
  d.booking.termsAccepted = true;
  assert.deepEqual(stepErrors(3, d, "2026-11-06"), {});
});
test("estimate input carries the chosen services and shared duration", () => {
  const d = filled();
  d.booking.insurance = "ARABIAN";
  d.booking.feed = "SPORT";
  const input = estimateInput(d, 0, 1457);
  assert.equal(input.durationDays, 3);
  assert.equal(input.horseCount, 1);
  assert.equal(input.insurance, "ARABIAN");
  assert.equal(input.feed, "SPORT");
  assert.equal(input.international, false);
});
test("order body matches the web payload and sends booking only with a distance", () => {
  const d = filled();
  const noRoute = orderBody(d, [profile("1")]) as any;
  assert.equal(noRoute.booking, undefined);
  assert.equal(noRoute.originAddress, "Trại Ba Vì, Ba Vì, Hà Nội");
  assert.equal(noRoute.horses[0].profileId, "1");
  d.booking.distanceKm = 1457;
  const body = orderBody(d, [profile("1")]) as any;
  assert.equal(body.booking.distanceKm, 1457);
  assert.equal(body.booking.durationDays, 3);
  assert.equal(body.booking.recipient.phone, "0901234567");
  assert.equal(body.booking.recipient.identityNumber, "012345678901");
  assert.equal(body.booking.pickupTime, "08:00 – 10:00");
  assert.equal(body.booking.vehicleCapacity, 2);
});
test("order body refuses a horse that is busy or lacks a passport", () => {
  assert.throws(() => orderBody(filled(), [profile("1", " ")]));
  assert.throws(() => orderBody(filled(), [{ ...profile("1"), activeOrderId: "9" }]));
});
test("reopening an order keeps web booking data and locks horses when it needs info", () => {
  const booking = { ...filled().booking, feed: "SPORT", vehicleCapacity: 6, vehicleClass: "MEDIUM", distanceKm: 300 };
  const order = (status: string) =>
    ({ id: 7, status, desired_departure_date: "2026-12-01T00:00:00.000Z", special_requirements: "Ghi chú", draft: null, booking_details: JSON.stringify(booking) }) as any;
  const horses = [{ id: "5", profileId: "1", name: "Sao", passportNo: "P" }] as any;
  const needInfo = draftFromOrder(order("NEED_INFO"), account, "r9", horses);
  assert.equal(needInfo.booking.feed, "SPORT");
  assert.equal(needInfo.booking.vehicleCapacity, 6);
  assert.equal(needInfo.date, "2026-12-01");
  assert.equal(needInfo.notes, "Ghi chú");
  assert.equal(needInfo.savedId, "7");
  assert.deepEqual(needInfo.lockedHorses, horses);
  assert.equal(draftFromOrder(order("DRAFT"), account, "r9", horses).lockedHorses, undefined);
  // Đơn cũ không có booking: mở được, người gửi để trống để khách bấm "Tôi là người gửi".
  const legacy = draftFromOrder({ ...order("DRAFT"), booking_details: null }, account, "r9", horses);
  assert.equal(legacy.booking.sender.name, "");
  assert.equal(legacy.booking.recipient.city, "");
});
test("old free-text drafts keep horses, date and notes, and ask for the address again", () => {
  const d = migrateOldDraft(
    { requestId: "old", savedId: "3", selected: ["1"], recipientName: "Anh Ba", recipientPhone: "0900000000", payload: { desiredDepartureDate: "2026-12-01", specialRequirements: "Sợ ồn" } },
    account,
    "new",
  );
  assert.equal(d.requestId, "old");
  assert.equal(d.savedId, "3");
  assert.deepEqual(d.selected, ["1"]);
  assert.equal(d.date, "2026-12-01");
  assert.equal(d.notes, "Sợ ồn");
  assert.equal(d.booking.recipient.name, "Anh Ba");
  assert.equal(d.booking.recipient.city, "");
  assert.equal(d.step, 0);
});

test("B13: đọc thông quan từ booking_details, cửa khẩu theo nước bên kia", async () => {
  const { customsOf, borderGates, CUSTOMS_EDITABLE } = await import("../src/booking-domain.ts");
  assert.deepEqual(customsOf('{"customsCode":"TK-1","border":"Hữu Nghị"}'), { customsCode: "TK-1", importPermit: "", border: "Hữu Nghị" });
  assert.deepEqual(customsOf({ importPermit: "GP-2" }), { customsCode: "", importPermit: "GP-2", border: "" });
  assert.deepEqual(customsOf("hỏng"), { customsCode: "", importPermit: "", border: "" });
  assert.deepEqual(borderGates("VN", "TH"), ["Lao Bảo", "Cầu Treo", "Mộc Bài"]);
  assert.equal(borderGates("CN", "VN")[0], "Hữu Nghị");
  assert.deepEqual(borderGates("VN", "VN"), []);
  assert.ok(CUSTOMS_EDITABLE.includes("IN_TRANSIT") && !CUSTOMS_EDITABLE.includes("DRAFT"));
});
