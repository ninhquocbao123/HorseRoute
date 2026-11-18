const { test } = require('node:test'); const assert = require('node:assert/strict');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { guardSeedRecipients } = require('../src/shared/mail/mailer');
const { SEED_ACCOUNTS, isSeedAccountEmail } = require('../src/shared/mail/seed-accounts');

const fake = () => { const sent = []; return { sent, mailer: { configured: true, send: async mail => { sent.push(mail); } } }; };

test('seed accounts never receive mail, real addresses still do', async () => {
  const { sent, mailer } = fake();
  const guarded = guardSeedRecipients(mailer, { NODE_ENV: 'production' });
  for (const account of SEED_ACCOUNTS) await guarded.send({ to: account.email.toUpperCase(), subject: 's', text: 't' });
  assert.equal(sent.length, 0);
  await guarded.send({ to: 'khach.that@example.org', subject: 's', text: 't' });
  assert.equal(sent.length, 1);
  assert.equal(guarded.configured, true);
});

test('MAIL_DISABLED blocks every recipient and reports not configured', async () => {
  const { sent, mailer } = fake();
  const guarded = guardSeedRecipients(mailer, { MAIL_DISABLED: 'true' });
  await guarded.send({ to: 'khach.that@example.org', subject: 's', text: 't' });
  assert.equal(sent.length, 0);
  assert.equal(guarded.configured, false);
});

test('seed list: gmail addresses, no demo/example/test, at least 3 drivers and 3 escorts with phone', () => {
  assert.ok(isSeedAccountEmail(' NguyenVanHung.Driver@gmail.com '));
  for (const a of SEED_ACCOUNTS) {
    assert.match(a.email, /^[a-z]+\.[a-z]+@gmail\.com$/);
    assert.doesNotMatch(a.email + a.fullName, /demo|example|test/i);
    assert.match(a.phone, /^0\d{9}$/);
  }
  const drivers = SEED_ACCOUNTS.filter(a => a.kind === 'DRIVER');
  assert.ok(drivers.length >= 3 && SEED_ACCOUNTS.filter(a => a.kind === 'ESCORT').length >= 3);
  for (const d of drivers) assert.match(d.license.number, /^\d{12}$/);
});
