import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());

// استخدم حزمة CORS لإرجاع رؤوس Access-Control المناسبة
// اسمح للأصل المنتج (frontend) بالوصول؛ عدّل القائمة حسب الحاجة
const allowedOrigins = [
  'https://datahub-44154.web.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // السماح بالوصول في حال كانت الطلبات من نفس المنشأ أو origin غير موجود (مثل أدوات الاختبار)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// دعم رد على طلبات preflight
app.options('*', cors());

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
