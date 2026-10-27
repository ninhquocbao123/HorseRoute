// Giai đoạn của chuyến (driver/trip-phase.ts) và các nơi dùng nó: timeline, thẻ "Chặng tiếp", thẻ "Đã chạy", nút Check-in.
// Mỗi trạng thái chặng NOT_STARTED / MOVING / AT_STOP / COMPLETED phải nhất quán giữa các phần. Chạy: node apps/web/test/trip-phase.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: `export * from './src/features/tracking/driver/trip-phase'; export { tripStops } from './src/features/tracking/driver/driver-ui'; export { currentLeg, nextAction } from './src/features/tracking/tracking.format';`,
      resolveDir: web, loader: 'ts',
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'phase-test.cjs'), module);
  mod.filename = path.join(web, 'phase-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { tripPhase, headingLeg, stoppedAtName, isStopped, nextStopView, elapsedSub, kmLeftOnLeg, tripStops, currentLeg, nextAction } = mod.exports;

  const now = Date.parse('2026-10-26T12:00:00Z');
  const at = h => new Date(now + h * 3600e3).toISOString();
  // 3 chặng: A → B (cửa khẩu) → C (trạm nghỉ) → D (đích)
  const stopsNames = [['A', 'B', 'BORDER'], ['B', 'C', 'REST_STOP'], ['C', 'D', 'REST_STOP']];
  const make = statuses => statuses.map((status, i) => ({
    id: String(i + 1), seqNo: i + 1, fromLocationId: 'f' + i, fromLocationName: stopsNames[i][0], toLocationId: 't' + i, toLocationName: stopsNames[i][1], toLocationType: stopsNames[i][2],
    vehicleId: '5', vehicleCode: 'XE', plannedDepartureAt: at(-1 + i * 3), plannedArrivalAt: at(1 + i * 3), status,
    actualDepartureAt: null, actualArrivalAt: null, updatedAt: null, updatedByName: null,
    milestones: status === 'COMPLETED' || (status === 'AT_STOP' && i === 0 && false) ? [{ milestoneType: 'CUSTOMS_CLEARED' }] : [],
  }));
  const mapOf = (legs, remainingKm) => ({ remainingKm, legs: legs.map((l, i) => ({ id: l.id, distanceKm: [100, 200, 300][i] })) });
  const flags = legs => Object.fromEntries(tripStops(legs, 2, true).map(s => [s.name, ['reached', 'current', 'stopped', 'next'].filter(k => s[k]).join('+') || '-']));

  // 1. Chưa xuất phát (READY)
  {
    const legs = make(['NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'not_started');
    assert.equal(isStopped(phase), false);
    assert.equal(currentLeg(legs).id, '1');
    assert.equal(nextAction(currentLeg(legs), legs, 'READY').milestone, 'DEPARTED');
    assert.equal(nextAction(legs[1], legs, 'READY'), null, 'chặng 2 chưa được xuất phát khi chặng 1 chưa xong');
    assert.deepEqual(flags(legs), { A: '-', B: '-', C: '-', D: '-' });
  }

  // 2. Đang chạy chặng 2 (chặng 1 đã xong)
  {
    const legs = make(['COMPLETED', 'MOVING', 'NOT_STARTED']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'moving');
    assert.equal(headingLeg(phase).id, '2');
    assert.equal(stoppedAtName(phase), null);
    assert.equal(currentLeg(legs).id, '2');
    assert.equal(nextAction(currentLeg(legs), legs, 'IN_TRANSIT').milestone, 'ARRIVED_AT_STOP');
    assert.deepEqual(flags(legs), { A: 'reached', B: 'reached', C: 'current', D: '-' });
    const view = nextStopView(phase, mapOf(legs, 350));
    assert.deepEqual([view.name, view.km, view.arrived], ['C', 50, false], '350 − 300 (chặng 3) = 50 km còn lại tới C');
    assert.match(elapsedSub(phase, now).text, /^nghỉ tiếp sau /);
  }

  // 3. Đang DỪNG giữa đường: chặng 2 AT_STOP tại C, chặng 3 chưa đi
  {
    const legs = make(['COMPLETED', 'AT_STOP', 'NOT_STARTED']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'stopped');
    assert.equal(isStopped(phase), true);
    assert.equal(stoppedAtName(phase), 'C');
    assert.equal(headingLeg(phase).id, '3');
    assert.equal(currentLeg(legs).id, '2', 'nút Check-in thao tác trên chặng đang dừng');
    assert.equal(nextAction(currentLeg(legs), legs, 'IN_TRANSIT').kind, 'complete', 'dừng ở trạm nghỉ: hoàn thành chặng');
    assert.deepEqual(flags(legs), { A: 'reached', B: 'reached', C: 'reached+stopped', D: 'next' });
    const stops = tripStops(legs, 2, true);
    assert.equal(stops[2].note, 'Đang dừng');
    assert.match(stops[3].note, /^Kế tiếp · /);
    assert.equal(stops.filter(s => s.current).length, 0, 'không còn điểm "đang tới" khi xe dừng');
    // Thẻ Chặng tiếp: điểm KẾ TIẾP, km của chặng kế, không bao giờ "0 km" của điểm đã tới
    const view = nextStopView(phase, mapOf(legs, 300));
    assert.deepEqual([view.name, view.km, view.arrived], ['D', 300, false]);
    // Thẻ Đã chạy: dự kiến xuất phát chặng kế (-1 + 2*3 = +5h) rồi trễ
    const early = elapsedSub(phase, now);
    assert.equal(early.warn, false);
    assert.match(early.text, /^đang dừng · dự kiến xuất phát (\d{2}\/\d{2} )?\d{2}:\d{2}$/);
    const late = elapsedSub(phase, now + 7 * 3600e3);
    assert.equal(late.warn, true);
    assert.equal(late.text, 'đang dừng · trễ xuất phát 2 giờ');
    const lateMinutes = elapsedSub(phase, now + 5 * 3600e3 + 25 * 60e3);
    assert.equal(lateMinutes.text, 'đang dừng · trễ xuất phát 25 phút');
  }

  // 4. Chặng 2 đã COMPLETED, chặng 3 chưa xuất phát (xe vẫn đứng tại C)
  {
    const legs = make(['COMPLETED', 'COMPLETED', 'NOT_STARTED']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'between');
    assert.equal(isStopped(phase), true);
    assert.equal(stoppedAtName(phase), 'C');
    assert.equal(currentLeg(legs).id, '3');
    assert.equal(nextAction(currentLeg(legs), legs, 'IN_TRANSIT').milestone, 'DEPARTED', 'nút Check-in: xuất phát chặng kế');
    assert.deepEqual(flags(legs), { A: 'reached', B: 'reached', C: 'reached+stopped', D: 'next' });
    assert.deepEqual([nextStopView(phase, mapOf(legs, 300)).name, nextStopView(phase, mapOf(legs, 300)).km], ['D', 300]);
    assert.match(elapsedSub(phase, now).text, /^đang dừng · dự kiến xuất phát/);
  }

  // 5. Dừng tại cửa khẩu: cần thông quan trước khi hoàn thành chặng
  {
    const legs = make(['AT_STOP', 'NOT_STARTED', 'NOT_STARTED']);
    legs[0].milestones = [];
    assert.equal(tripPhase(legs).kind, 'stopped');
    assert.equal(nextAction(currentLeg(legs), legs, 'IN_TRANSIT').milestone, 'CUSTOMS_CLEARED');
    assert.equal(nextStopView(tripPhase(legs), mapOf(legs, 600)).name, 'C');
    assert.deepEqual(flags(legs), { A: 'reached', B: 'reached+stopped', C: 'next', D: '-' });
  }

  // 6. Đã tới điểm đích (chặng cuối AT_STOP): chờ bàn giao, không có "kế tiếp"
  {
    const legs = make(['COMPLETED', 'COMPLETED', 'AT_STOP']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'stopped');
    assert.equal(headingLeg(phase), null);
    assert.equal(nextAction(currentLeg(legs), legs, 'IN_TRANSIT').milestone, 'DELIVERED');
    const view = nextStopView(phase, mapOf(legs, 0));
    assert.deepEqual([view.name, view.km, view.arrived], ['D', null, true]);
    assert.equal(elapsedSub(phase, now).text, 'đang dừng · chờ bàn giao');
    assert.equal(tripStops(legs, 2, true).filter(s => s.next).length, 0);
    assert.equal(tripStops(legs, 2, true)[3].stopped, true);
  }

  // 7. Xong hết
  {
    const legs = make(['COMPLETED', 'COMPLETED', 'COMPLETED']);
    const phase = tripPhase(legs);
    assert.equal(phase.kind, 'finished');
    assert.equal(nextStopView(phase, null), null);
    assert.equal(tripStops(legs, 2, true).some(s => s.stopped || s.next || s.current), false);
  }

  // 8. READY (running = false): timeline không có cờ chạy/dừng/kế tiếp
  assert.equal(tripStops(make(['COMPLETED', 'AT_STOP', 'NOT_STARTED']), 2, false).some(s => s.stopped || s.next || s.current), false);

  // 9. kmLeftOnLeg
  assert.equal(kmLeftOnLeg({ remainingKm: null, legs: [] }, '1'), null);
  assert.equal(kmLeftOnLeg(mapOf(make(['MOVING', 'NOT_STARTED', 'NOT_STARTED']), 450), '1'), 0 + Math.max(0, 450 - 500));
  console.log('trip-phase: ok');
})().catch(e => { console.error(e); process.exit(1); });
