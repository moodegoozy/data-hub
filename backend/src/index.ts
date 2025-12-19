import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// تمكين CORS بسيط للسماح للواجهة بالوصول أثناء التطوير
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// اختبار Cloud NAT
app.get("/ip", async (_req, res) => {
  const { data } = await axios.get("https://api.ipify.org");
  res.json({ egressIp: String(data).trim() });
});

// هنا مستقبلاً تحط كود MikroTik
app.get("/", (_req, res) => res.send("mikrotik api running"));

// اختبار اتصال بسيط لميكروتيك: يحاول فتح اتصال TCP إلى منفذ 8728 (API)
app.post('/mikrotik/connect', (req, res) => {
  const { ip, port = 8728 } = req.body as { ip?: string; port?: number };
  if (!ip) return res.status(400).json({ error: 'missing ip' });

  const net = require('net');
  const socket = new net.Socket();
  let finished = false;

  socket.setTimeout(5000);

  socket.on('connect', () => {
    if (finished) return;
    finished = true;
    socket.destroy();
    return res.json({ message: `connected to ${ip}:${port}` });
  });

  socket.on('timeout', () => {
    if (finished) return;
    finished = true;
    socket.destroy();
    return res.status(504).json({ error: 'timeout' });
  });

  socket.on('error', (err: Error) => {
    if (finished) return;
    finished = true;
    socket.destroy();
    return res.status(502).json({ error: err.message });
  });

  socket.connect(port, ip);
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log("listening on", port));
