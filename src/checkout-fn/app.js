const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '50kb' }));

function getReqId(req) {
  return req.header('X-Request-Id') || crypto.randomUUID();
}

app.use((req, res, next) => {
  const rid = getReqId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  console.log(`[rid=${rid}] ${req.method} ${req.path}`);
  next();
});

const PRICING_URL = process.env.PRICING_URL || 'http://pricing-fn:3001';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://inventory-fn:3002';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 1500);

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, cancel: () => clearTimeout(t) };
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/checkout', async (req, res) => {
  const { sku, subtotal } = req.body;
  const skuNum = Number(sku);
  const subNum = Number(subtotal);

  if (!Number.isInteger(skuNum)) {
    return res.status(400).json({ error: 'sku must be an integer' });
  }
  if (!Number.isFinite(subNum) || subNum < 0) {
    return res.status(400).json({ error: 'subtotal must be a non-negative number' });
  }

  const pricingCtl = withTimeout(TIMEOUT_MS);
  const invCtl = withTimeout(TIMEOUT_MS);

  try {
    const [priceRes, stockRes] = await Promise.all([
      fetch(`${PRICING_URL}/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': req.requestId
        },
        body: JSON.stringify({ subtotal: subNum }),
        signal: pricingCtl.signal,
      }),
      fetch(`${INVENTORY_URL}/stock/${skuNum}`, {
        headers: {
          'X-Request-Id': req.requestId
        },
        signal: invCtl.signal,
      }),
    ]);

    if (!priceRes.ok) {
      return res.status(502).json({ error: 'pricing service error' });
    }

    if (!stockRes.ok) {
      return res.status(502).json({ error: 'inventory service error' });
    }

    const priceData = await priceRes.json();
    const stockData = await stockRes.json();

    return res.json({
      ok: true,
      total: priceData.total,
      stock: stockData
    });

  } catch (err) {
    console.error(`[rid=${req.requestId}] error:`, err.message);
    return res.status(504).json({ error: 'timeout or upstream failure' });
  } finally {
    pricingCtl.cancel();
    invCtl.cancel();
  }
});

app.listen(PORT, () => {
  console.log(`checkout-fn listening on ${PORT}`);
});
