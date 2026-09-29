const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'test-password';
const accessSettingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sih26238-access-setting-'));
process.env.ACCESS_SETTING_FILE = path.join(accessSettingDirectory, 'access-setting.json');

const { createServer, writeAccessSetting } = require('./server.cjs');

let server;
let baseUrl;

test.before(async () => {
  await writeAccessSetting('RESTRICTED');
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await writeAccessSetting('RESTRICTED');
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(accessSettingDirectory, { recursive: true, force: true });
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

test('authenticated administrators can persist both access modes', async () => {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'test-password' })
  });
  assert.equal(loginResponse.status, 200);

  const cookie = loginResponse.headers.get('set-cookie').split(';', 1)[0];
  for (const accessMode of ['PUBLIC', 'RESTRICTED']) {
    const updateResponse = await fetch(`${baseUrl}/api/access-setting`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({ accessMode })
    });

    assert.equal(updateResponse.status, 200);
    assert.deepEqual(await updateResponse.json(), { accessMode });
    assert.deepEqual(JSON.parse(fs.readFileSync(process.env.ACCESS_SETTING_FILE, 'utf8')), { accessMode });
    const readResponse = await fetch(`${baseUrl}/api/access-setting`);
    assert.deepEqual(await readResponse.json(), { accessMode });
  }

  const adminAccessResponse = await fetch(`${baseUrl}/api/application-access`, {
    headers: { Cookie: cookie }
  });
  assert.equal(adminAccessResponse.status, 200);
});

test('Vercel KV persists both access modes across API requests', async () => {
  let storedValue;
  const kvServer = require('node:http').createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const [operation, , value] = JSON.parse(body);
    if (operation === 'SET') storedValue = value;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ result: operation === 'GET' ? storedValue ?? null : 'OK' }));
  });
  await new Promise((resolve) => kvServer.listen(0, '127.0.0.1', resolve));
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  process.env.KV_REST_API_URL = `http://127.0.0.1:${kvServer.address().port}`;
  process.env.KV_REST_API_TOKEN = 'test-token';

  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'test-password' })
    });
    const cookie = loginResponse.headers.get('set-cookie').split(';', 1)[0];

    for (const accessMode of ['RESTRICTED', 'PUBLIC']) {
      const response = await fetch(`${baseUrl}/api/access-setting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ accessMode })
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { accessMode });

      const readResponse = await fetch(`${baseUrl}/api/access-setting`);
      assert.deepEqual(await readResponse.json(), { accessMode });
    }
  } finally {
    if (previousUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = previousToken;
    await new Promise((resolve) => kvServer.close(resolve));
  }
});
