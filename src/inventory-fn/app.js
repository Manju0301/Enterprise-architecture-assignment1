const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;

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

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/stock/:sku', (req, res) => {
  const skuNum = Number(req.params.sku);

  if (!Number.isInteger(skuNum)) {
    return res.status(400).json({ error: 'sku must be an integer' });
  }

  res.json({
    sku: skuNum,
    inStock: true,
    qty: 42
  });
});

app.listen(PORT, () => {
  console.log(`inventory-fn listening on ${PORT}`);
});
