const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'test-password';

const { createServer } = require('./server.cjs');

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('login returns the same generic error for an unknown email or password', async () => {
  const invalidCredentials = [
    { email: 'admin@example.com', password: 'wrong-password' },
    { email: 'unknown@example.com', password: 'test-password' }
  ];

  for (const credentials of invalidCredentials) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { message: 'Invalid credentials' });
  }
});

test('login accepts a Vercel-stripped API prefix', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' })
  });

  assert.equal(response.status, 401);
});