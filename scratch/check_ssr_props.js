const http = require('http');

async function testFetch(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  const routes = ['/login', '/overview', '/leads', '/companies', '/conversations', '/activity'];
  for (const route of routes) {
    try {
      const res = await testFetch(route);
      const hasAlignItems = res.data.includes('alignItems=');
      const hasJustifyContent = res.data.includes('justifyContent=');
      const hasItemProp = res.data.includes('item="true"');
      console.log(`Route ${route}: status=${res.status}, hasAlignItems=${hasAlignItems}, hasJustifyContent=${hasJustifyContent}, hasItemProp=${hasItemProp}`);
    } catch (e) {
      console.error(`Route ${route} error:`, e.message);
    }
  }
}

run();
