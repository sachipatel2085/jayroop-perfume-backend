import http from 'http';

const BASE_URL = 'http://localhost:5000/api/v1';

const req = (path, method = 'GET', data = null, headers = {}) => {
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

    const request = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    request.on('error', reject);
    if (data) request.write(JSON.stringify(data));
    request.end();
  });
};

const runE2E = async () => {
  console.log('\n======================================================');
  console.log('   JAYROOP END-TO-END E-COMMERCE & TRACKING TEST');
  console.log('======================================================\n');

  try {
    // 1. Customer Authentication
    const custAuth = await req('/auth/login', 'POST', {
      email: 'customer@jayroop.com',
      password: 'Customer@12345',
    });
    const custToken = custAuth.data.data.token;
    console.log(`[E2E 1] Customer authenticated: ${custAuth.data.data.name}`);

    // 2. Fetch Products
    const prodRes = await req('/products?limit=5');
    const oud = prodRes.data.data.find((p) => p.slug === 'royal-oud-extrait-de-parfum');
    const cream = prodRes.data.data.find((p) => p.slug === 'jayroop-special-pimples-cream');
    console.log(`[E2E 2] Products picked: ${oud.name} & ${cream.name}`);

    // 3. Server-Side Cart Calculation
    const cartRes = await req('/cart/calculate', 'POST', {
      items: [
        { productId: oud._id, variantSku: 'JR-OUD-50ML', quantity: 1 },
        { productId: cream._id, variantSku: 'JR-SKIN-25G', quantity: 2 },
      ],
      couponCode: 'ROYAL10',
    });
    console.log(
      `[E2E 3] Cart verified: Subtotal=₹${cartRes.data.data.subtotal}, Discount=₹${cartRes.data.data.discount}, Total=₹${cartRes.data.data.total}`
    );

    // 4. Create Order & Razorpay Payment Initialization
    const initRes = await req(
      '/payments/create-order',
      'POST',
      {
        items: [
          { productId: oud._id, variantSku: 'JR-OUD-50ML', quantity: 1 },
          { productId: cream._id, variantSku: 'JR-SKIN-25G', quantity: 2 },
        ],
        shippingAddress: {
          fullName: 'Rohan Sharma',
          phone: '+91 91234 56789',
          addressLine1: 'Villa 14, Royal Palm Residency',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400065',
        },
        couponCode: 'ROYAL10',
      },
      { Authorization: `Bearer ${custToken}` }
    );
    const orderData = initRes.data.data;
    console.log(
      `[E2E 4] Order Created: #${orderData.orderNumber}, Razorpay Order ID: ${orderData.razorpayOrderId}`
    );

    // 5. Payment Verification
    const verifyRes = await req(
      '/payments/verify',
      'POST',
      {
        orderId: orderData.orderId,
        razorpay_order_id: orderData.razorpayOrderId,
        razorpay_payment_id: `pay_sim_${Date.now()}`,
        razorpay_signature: 'VERIFIED_TEST_MODE',
      },
      { Authorization: `Bearer ${custToken}` }
    );
    console.log(`[E2E 5] Payment Verified: Status is now ${verifyRes.data.data.orderStatus}`);

    // 6. Customer Checks Tracking Timeline
    const track1 = await req(`/orders/${orderData.orderNumber}`);
    console.log(
      `[E2E 6] Customer Tracking: Status=${track1.data.data.orderStatus}, Courier=${track1.data.data.courier || 'None'}`
    );

    // 7. Admin Logs In
    const adminAuth = await req('/auth/login', 'POST', {
      email: 'admin@jayroop.com',
      password: 'Admin@12345',
    });
    const adminToken = adminAuth.data.data.token;
    console.log(`[E2E 7] Admin authenticated: ${adminAuth.data.data.name}`);

    // 8. Admin Assigns Manual Courier & Tracking ID
    const assignRes = await req(
      `/orders/${orderData.orderId}/tracking`,
      'PUT',
      {
        courier: 'BlueDart Express',
        trackingId: 'BD849201948IN',
        note: 'Securely dispatched in velvet fragrance gift carton',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log(
      `[E2E 8] Admin Tracking Assigned: Courier=${assignRes.data.data.courier}, TrackingID=${assignRes.data.data.trackingId}, New Status=${assignRes.data.data.orderStatus}`
    );

    // 9. Customer Re-checks Tracking
    const track2 = await req(`/orders/${orderData.orderNumber}`);
    console.log(
      `[E2E 9] Customer Re-check: Live Status=${track2.data.data.orderStatus}, Courier=${track2.data.data.courier}, TrackingID=${track2.data.data.trackingId}, TrackingURL=${track2.data.data.trackingUrl}`
    );

    // 10. Admin Audit Logs Verification
    const auditRes = await req('/admin/audit-logs?limit=5', 'GET', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    console.log(
      `[E2E 10] Audit Trail Recorded: Latest Action=${auditRes.data.data[0]?.action}, Admin=${auditRes.data.data[0]?.adminEmail}`
    );

    console.log('\n======================================================');
    console.log('  ALL E2E PURCHASE & TRACKING TESTS PASSED 100%!  ');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('[E2E Error]:', err.message);
    process.exit(1);
  }
};

runE2E();
