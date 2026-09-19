const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = __dirname;
let accessSetting = 'RESTRICTED';

function loadEnvFile() {
  const envFile = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envFile)) return;

  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || getAdminPassword();
}

function ensureConfiguration() {
  if (getAdminEmails().length === 0 || !getAdminPassword()) {
    throw new Error('ADMIN_EMAILS and ADMIN_PASSWORD must be configured in .env. See .env.example.');
  }
}

function createSessionToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    role: 'Administrator',
    expiresAt: Date.now() + 8 * 60 * 60 * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readAccessSetting() {
  return accessSetting;
}

function writeAccessSetting(accessMode) {
  accessSetting = accessMode === 'PUBLIC' ? 'PUBLIC' : 'RESTRICTED';
}

function parseCookies(request) {
  const cookies = {};
  for (const item of (request.headers.cookie || '').split(';')) {
    const separator = item.indexOf('=');
    if (separator === -1) continue;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
  }
  return cookies;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getSession(request) {
  const token = parseCookies(request).admin_session;
  if (!token) return undefined;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return undefined;

  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) return undefined;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.expiresAt > Date.now() ? session : undefined;
  } catch {
    return undefined;
  }
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(body ?? { message: 'Request failed.' }));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) reject(new Error('Request body is too large.'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

async function handleRequest(request, response) {
  console.log('[api] handleRequest invoked', request.method, request.url);

  try {
    const url = new URL(request.url, 'http://localhost');
    const routePath = url.pathname.replace(/^\/api(?=\/|$)/, '');

    if (routePath === '/access-setting' && request.method === 'GET') {
      return sendJson(response, 200, { accessMode: readAccessSetting() });
    }

    if (routePath === '/application-access' && request.method === 'GET') {
      const session = getSession(request);
      const isAdmin = session && session.role === 'Administrator';
      if (readAccessSetting() === 'RESTRICTED' && !isAdmin) {
        return sendJson(response, 403, { message: 'Access Restricted' });
      }
      return sendJson(response, 200, { allowed: true });
    }

    if (routePath === '/auth/login' && request.method === 'POST') {
      ensureConfiguration();
      const body = await readJsonBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!getAdminEmails().includes(email) || !safeEqual(password, getAdminPassword())) {
        return sendJson(response, 401, { message: 'Invalid administrator credentials.' });
      }

      const token = createSessionToken(email);
      return sendJson(response, 200, {
        user: { email, role: 'Administrator' }
      }, {
        'Set-Cookie': `admin_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
      });
    }

    if (routePath === '/auth/logout' && request.method === 'POST') {
      return sendJson(response, 200, { ok: true }, {
        'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
      });
    }

    if (routePath === '/auth/me' && request.method === 'GET') {
      const session = getSession(request);
      return session
        ? sendJson(response, 200, { authenticated: true, user: { email: session.email, role: session.role } })
        : sendJson(response, 401, { authenticated: false });
    }

    if (routePath === '/access-setting' && request.method === 'PUT') {
      const session = getSession(request);
      if (!session || session.role !== 'Administrator') {
        return sendJson(response, 403, { message: 'Administrator authentication is required.' });
      }

      const body = await readJsonBody(request);
      if (body.accessMode !== 'PUBLIC' && body.accessMode !== 'RESTRICTED') {
        return sendJson(response, 400, { message: 'accessMode must be PUBLIC or RESTRICTED.' });
      }

      writeAccessSetting(body.accessMode);
      return sendJson(response, 200, { accessMode: body.accessMode });
    }

    return sendJson(response, 404, { message: 'Not found.' });
  } catch (error) {
    const statusCode = error.message.includes('must be configured') ? 500 : 400;
    return sendJson(response, statusCode, { message: error.message });
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  createServer().listen(port, () => {
    console.log(`Scholarship API listening on http://localhost:${port}`);
    if (getAdminEmails().length === 0 || !getAdminPassword()) {
      console.warn('ADMIN_EMAILS and ADMIN_PASSWORD are not configured; administrator login is disabled.');
    }
  });
}

module.exports = { createServer, handleRequest, readAccessSetting, writeAccessSetting };
