const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/price', (req, res) => {
  const { subtotal } = req.body;
  const subNum = Number(subtotal);

  if (!Number.isFinite(subNum) || subNum < 0) {
    return res.status(400).json({ error: 'subtotal must be a non-negative number' });
  }

  const total = Number((subNum * 1.18).toFixed(2));
  res.json({ total });
});

app.listen(PORT, () => {
  console.log(`pricing-fn listening on ${PORT}`);
});
