const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'test-password';

const { createServer, writeAccessSetting } = require('./server.cjs');

let server;
let baseUrl;

test.before(async () => {
  writeAccessSetting('RESTRICTED');
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  writeAccessSetting('RESTRICTED');
  await new Promise((resolve) => server.close(resolve));
});

test('non-admin callers cannot change the access setting', async () => {
  const response = await fetch(`${baseUrl}/api/access-setting`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessMode: 'PUBLIC' })
  });

  assert.equal(response.status, 403);
});

test('normal callers are blocked from the application in Restricted mode', async () => {
  const response = await fetch(`${baseUrl}/api/application-access`);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'Access Restricted' });
});

test('invalid administrator credentials are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'wrong-password' })
  });

  assert.equal(response.status, 401);
});

test('authenticated administrators can persist the access setting', async () => {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'test-password' })
  });
  assert.equal(loginResponse.status, 200);

  const cookie = loginResponse.headers.get('set-cookie').split(';', 1)[0];
  const updateResponse = await fetch(`${baseUrl}/api/access-setting`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify({ accessMode: 'PUBLIC' })
  });

  assert.equal(updateResponse.status, 200);
  assert.deepEqual(await updateResponse.json(), { accessMode: 'PUBLIC' });

  const adminAccessResponse = await fetch(`${baseUrl}/api/application-access`, {
    headers: { Cookie: cookie }
  });
  assert.equal(adminAccessResponse.status, 200);

  const readResponse = await fetch(`${baseUrl}/api/access-setting`);
  assert.deepEqual(await readResponse.json(), { accessMode: 'PUBLIC' });
});
