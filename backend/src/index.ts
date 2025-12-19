import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// اختبار Cloud NAT
app.get("/ip", async (_req, res) => {
  const { data } = await axios.get("https://api.ipify.org");
  res.json({ egressIp: String(data).trim() });
});

// هنا مستقبلاً تحط كود MikroTik
app.get("/", (_req, res) => res.send("mikrotik api running"));

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log("listening on", port));
