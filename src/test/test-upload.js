import http from 'http';

const loginAdmin = () => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@jayroop.com',
      password: 'Admin@12345',
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const parsed = JSON.parse(body);
          resolve(parsed.data?.token);
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const testUpload = (token) => {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    // Create a simple 1x1 GIF / PNG dummy buffer
    const fakeImageBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    
    let postDataStart = `--${boundary}\r\n`;
    postDataStart += `Content-Disposition: form-data; name="folder"\r\n\r\n`;
    postDataStart += `products\r\n`;
    postDataStart += `--${boundary}\r\n`;
    postDataStart += `Content-Disposition: form-data; name="file"; filename="sample-flacon.png"\r\n`;
    postDataStart += `Content-Type: image/png\r\n\r\n`;

    const postDataEnd = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(postDataStart, 'utf-8'),
      fakeImageBuffer,
      Buffer.from(postDataEnd, 'utf-8'),
    ]);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/upload',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
};

const run = async () => {
  try {
    console.log('Logging in as Admin...');
    const token = await loginAdmin();
    console.log('Admin token acquired. Testing POST /api/v1/upload ...');
    const res = await testUpload(token);
    console.log('Upload Result Status:', res.status);
    console.log('Upload Response:', JSON.stringify(res.data, null, 2));
    if (res.status === 200 && res.data.success && res.data.url) {
      console.log('✅ UPLOAD TEST PASSED!');
    } else {
      console.error('❌ UPLOAD TEST FAILED:', res);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
};

run();
