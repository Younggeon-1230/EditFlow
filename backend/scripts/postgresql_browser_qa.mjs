import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const frontendUrl = process.env.QA_FRONTEND_URL || 'http://127.0.0.1:5174'
const apiUrl = process.env.QA_API_URL || 'http://127.0.0.1:8001'
const edgePath = process.env.EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const debugPort = 9223
const profile = await mkdtemp(path.join(tmpdir(), 'editflow-edge-'))

const delay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

async function findPage() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
        .then((response) => response.json())
      const page = pages.find((entry) => entry.type === 'page')
      if (page) return page
    } catch {
      // Edge may still be starting.
    }
    await delay(250)
  }
  throw new Error('Headless Edge DevTools endpoint did not start')
}

class CdpClient {
  constructor(url) {
    this.nextId = 1
    this.pending = new Map()
    this.socket = new WebSocket(url)
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = this.nextId
    this.nextId += 1
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket.close()
  }
}

const edge = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--no-first-run',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  frontendUrl,
], { stdio: 'ignore' })

try {
  const page = await findPage()
  const cdp = new CdpClient(page.webSocketDebuggerUrl)
  await cdp.open()
  await cdp.send('Page.enable')
  await cdp.send('Network.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url: frontendUrl })
  await delay(1000)

  const emailSuffix = Date.now()
  const expression = `
    (async () => {
      const apiUrl = ${JSON.stringify(apiUrl)};
      const password = 'PostgreSQL browser QA password';
      const accountA = 'browser-a-${emailSuffix}@example.com';
      const accountB = 'browser-b-${emailSuffix}@example.com';
      const cookie = (name) => document.cookie.split('; ')
        .find((part) => part.startsWith(name + '='))?.split('=')[1];
      const request = async (path, options = {}) => {
        const method = options.method || 'GET';
        const headers = { ...(options.headers || {}) };
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          if (!cookie('editflow_csrf')) {
            await fetch(apiUrl + '/api/auth/csrf', { credentials: 'include' });
          }
          headers['X-CSRF-Token'] = decodeURIComponent(cookie('editflow_csrf'));
          headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(apiUrl + path, {
          ...options,
          method,
          headers,
          credentials: 'include',
        });
        const data = response.status === 204 ? null : await response.json();
        return { status: response.status, data };
      };
      const post = (path, body) => request(path, {
        method: 'POST', body: JSON.stringify(body),
      });
      const patch = (path, body) => request(path, {
        method: 'PATCH', body: JSON.stringify(body),
      });

      const signupA = await post('/api/auth/signup', {
        email: accountA, password,
      });
      const meBeforeReload = await request('/api/auth/me');

      const project = await post('/api/projects', {
        title: 'PostgreSQL browser project', status: 'planning',
      });
      const missingCsrf = await fetch(apiUrl + '/api/projects/' + project.data.id, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Must not update without CSRF' }),
      });
      const invalidCsrf = await fetch(apiUrl + '/api/projects/' + project.data.id, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token',
        },
        body: JSON.stringify({ title: 'Must not update with invalid CSRF' }),
      });
      const updated = await patch('/api/projects/' + project.data.id, {
        title: 'PostgreSQL browser project updated',
      });
      const checklist = await post(
        '/api/projects/' + project.data.id + '/checklist-items',
        { title: 'Browser checklist', is_completed: false, position: 0 },
      );
      const memo = await post('/api/projects/' + project.data.id + '/memos', {
        content: 'Browser memo', position: 0,
      });
      const idea = await post('/api/content-ideas', {
        title: 'Browser idea', platform: 'youtube',
      });
      const conversion = await post(
        '/api/content-ideas/' + idea.data.id + '/convert-to-project',
        { title: 'Browser converted project', create_default_checklist: true },
      );
      const legacy = await post('/api/projects/import-local', {
        source_local_id: 'browser-local-${emailSuffix}',
        title: 'Browser legacy import',
        status: 'planning',
        checklist_items: [],
        memos: [],
      });

      const logoutA = await post('/api/auth/logout', {});
      const signupB = await post('/api/auth/signup', {
        email: accountB, password,
      });
      const isolation = await request('/api/projects/' + project.data.id);
      await post('/api/auth/logout', {});
      const loginA = await post('/api/auth/login', { email: accountA, password });
      const projects = await request('/api/projects');

      return {
        signupA: signupA.status,
        meBeforeReload: meBeforeReload.status,
        projectCreate: project.status,
        projectId: project.data.id,
        missingCsrf: missingCsrf.status,
        invalidCsrf: invalidCsrf.status,
        projectUpdate: updated.status,
        checklistCreate: checklist.status,
        memoCreate: memo.status,
        ideaCreate: idea.status,
        conversion: conversion.status,
        legacyImport: legacy.status,
        logoutA: logoutA.status,
        signupB: signupB.status,
        crossAccountIsolation: isolation.status,
        loginA: loginA.status,
        projectList: projects.status,
        projectCount: projects.data.length,
      };
    })()
  `
  const first = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (first.exceptionDetails) {
    throw new Error(first.exceptionDetails.exception?.description || 'Browser QA failed')
  }

  const cookies = (await cdp.send('Network.getAllCookies')).cookies
  const sessionCookie = cookies.find((cookie) => cookie.name === 'editflow_session')
  const csrfCookie = cookies.find((cookie) => cookie.name === 'editflow_csrf')
  if (!sessionCookie || !csrfCookie) {
    throw new Error('Expected authentication cookies were not present')
  }
  if (new URL(frontendUrl).protocol === 'https:') {
    if (!sessionCookie.secure || !sessionCookie.httpOnly || sessionCookie.sameSite !== 'Lax') {
      throw new Error('Session cookie production attributes are invalid')
    }
    if (!csrfCookie.secure || csrfCookie.httpOnly || csrfCookie.sameSite !== 'Lax') {
      throw new Error('CSRF cookie production attributes are invalid')
    }
    if (sessionCookie.domain.startsWith('.') || csrfCookie.domain.startsWith('.')) {
      throw new Error('Authentication cookies must be host-only')
    }
  }

  const cookieHeader = cookies
    .filter((cookie) => ['editflow_session', 'editflow_csrf'].includes(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
  const invalidOrigin = await fetch(
    `${apiUrl}/api/projects/${first.result.value.projectId}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: cookieHeader,
        Origin: 'https://invalid.example',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfCookie.value,
      },
      body: JSON.stringify({ title: 'Must not update from invalid origin' }),
    },
  )

  await cdp.send('Page.navigate', {
    url: `${frontendUrl}/projects/${first.result.value.projectId}`,
  })
  await delay(1000)
  await cdp.send('Page.reload', { ignoreCache: true })
  await delay(1000)
  const restored = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const response = await fetch(${JSON.stringify(apiUrl)} + '/api/auth/me', {
        credentials: 'include',
      });
      return response.status;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  const result = {
    ...first.result.value,
    invalidOrigin: invalidOrigin.status,
    reloadSession: restored.result.value,
    sessionCookieSecure: sessionCookie.secure,
    sessionCookieHttpOnly: sessionCookie.httpOnly,
    sessionCookieSameSite: sessionCookie.sameSite,
    csrfCookieSecure: csrfCookie.secure,
    csrfCookieHttpOnly: csrfCookie.httpOnly,
    csrfCookieSameSite: csrfCookie.sameSite,
  }
  delete result.projectId
  const expected = {
    signupA: 201,
    meBeforeReload: 200,
    projectCreate: 201,
    missingCsrf: 403,
    invalidCsrf: 403,
    projectUpdate: 200,
    checklistCreate: 201,
    memoCreate: 201,
    ideaCreate: 201,
    conversion: 201,
    legacyImport: 201,
    logoutA: 204,
    signupB: 201,
    crossAccountIsolation: 404,
    loginA: 200,
    projectList: 200,
    invalidOrigin: 403,
    reloadSession: 200,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) {
      throw new Error(`${key}: expected ${value}, received ${result[key]}`)
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`)
  cdp.close()
} finally {
  try {
    execFileSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } catch {
    edge.kill()
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true })
      break
    } catch (error) {
      if (attempt === 9) throw error
      await delay(250)
    }
  }
}
