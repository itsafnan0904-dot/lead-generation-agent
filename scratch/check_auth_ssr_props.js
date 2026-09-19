const http = require('http');

async function loginAndGetCookie() {
  const payload = JSON.stringify({ email: 'admin@example.com', password: 'password123' });
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve(cookies.map(c => c.split(';')[0]).join('; '));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testFetchAuth(path, cookie) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, {
      headers: { Cookie: cookie },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  const cookie = await loginAndGetCookie();
  console.log('Got cookie, testing dashboard SSR routes...');
  const routes = ['/overview', '/leads', '/companies', '/conversations', '/activity', '/gmail', '/notifications'];
  for (const route of routes) {
    try {
      const res = await testFetchAuth(route, cookie);
      const hasAlignItems = res.data.includes('alignItems=');
      const hasJustifyContent = res.data.includes('justifyContent=');
      const hasItemProp = res.data.includes('item="true"') || res.data.includes('item=');
      console.log(`Route ${route}: status=${res.status}, hasAlignItems=${hasAlignItems}, hasJustifyContent=${hasJustifyContent}, hasItemProp=${hasItemProp}, size=${res.data.length}`);
    } catch (e) {
      console.error(`Route ${route} error:`, e.message);
    }
  }
}

run();
