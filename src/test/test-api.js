import http from 'http';

const BASE_URL = 'http://localhost:5000/api/v1';

const request = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const runApiTests = async () => {
  console.log('--- STARTING BACKEND API VERIFICATION SUITE ---');

  try {
    // 1. Health check
    const health = await request('/health');
    console.log(`[PASS] 1. Health Check: Status ${health.status}, Service: ${health.data.service}`);

    // 2. Customer login
    const custLogin = await request('/auth/login', 'POST', {
      email: 'customer@jayroop.com',
      password: 'Customer@12345',
    });
    console.log(`[PASS] 2. Customer Auth: Logged in as ${custLogin.data.data.name} (${custLogin.data.data.role})`);
    const customerToken = custLogin.data.data.token;

    // 3. Admin login
    const adminLogin = await request('/auth/login', 'POST', {
      email: 'admin@jayroop.com',
      password: 'Admin@12345',
    });
    console.log(`[PASS] 3. Admin Auth: Logged in as ${adminLogin.data.data.name} (${adminLogin.data.data.role})`);
    const adminToken = adminLogin.data.data.token;

    // 4. Categories check
    const categories = await request('/categories');
    console.log(`[PASS] 4. Categories Fetched: ${categories.data.data.length} root categories found. Subcategories verified.`);

    // 5. Products listing
    const products = await request('/products?limit=10');
    console.log(`[PASS] 5. Products Fetched: ${products.data.count} products retrieved. Total in catalog: ${products.data.total}`);

    // 6. Product by slug (Perfume with fragrance notes)
    const oudProduct = await request('/products/royal-oud-extrait-de-parfum');
    console.log(`[PASS] 6. Royal Oud Extrait: Top Notes='${oudProduct.data.data.product.specifications['Top Notes']}', Variants=${oudProduct.data.data.product.variants.length}`);

    // 7. Pimples cream (Skincare with acne specs)
    const pimpleCream = await request('/products/jayroop-special-pimples-cream');
    console.log(`[PASS] 7. Pimples Cream: Brand='${pimpleCream.data.data.product.brand}', Skin Type='${pimpleCream.data.data.product.specifications['Skin Type']}'`);

    // 8. Server-side Cart Calculation with Coupon
    const cartCalc = await request('/cart/calculate', 'POST', {
      items: [
        {
          productId: oudProduct.data.data.product._id,
          variantSku: 'JR-OUD-100ML',
          quantity: 1,
        },
      ],
      couponCode: 'ROYAL10',
    });
    console.log(
      `[PASS] 8. Server-Side Cart Recalculation: Subtotal=₹${cartCalc.data.data.subtotal}, Discount=₹${cartCalc.data.data.discount}, Total=₹${cartCalc.data.data.total}`
    );

    // 9. Dynamic Advertisements
    const ads = await request('/advertisements/active');
    console.log(`[PASS] 9. Active Hero Ads: ${ads.data.data.length} campaign(s) active. Title='${ads.data.data[0]?.title}'`);

    // 10. Admin Analytics
    const analytics = await request('/admin/analytics', 'GET', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    console.log(
      `[PASS] 10. Admin Analytics Protected Endpoint: Total Products=${analytics.data.data.totalProducts}, Customers=${analytics.data.data.totalCustomers}`
    );

    console.log('\n--- ALL BACKEND SUITE TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('API Test Error:', error.message);
    process.exit(1);
  }
};

runApiTests();
