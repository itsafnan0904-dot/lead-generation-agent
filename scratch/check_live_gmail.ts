import * as http from 'http';

async function postLogin(): Promise<string> {
  const payload = JSON.stringify({
    email: 'admin@enterprise.com',
    password: 'Password123!',
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:3000/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const rawCookies = res.headers['set-cookie'] || [];
          const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');
          resolve(cookieHeader);
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getGmailStatus(cookie: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http
      .get(
        'http://localhost:3000/api/gmail/status',
        {
          headers: { Cookie: cookie },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          });
        },
      )
      .on('error', reject);
  });
}

async function main() {
  const cookie = await postLogin();
  const status = await getGmailStatus(cookie);
  console.log('Current Gmail Status:', JSON.stringify(status, null, 2));
}

main().catch(console.error);
