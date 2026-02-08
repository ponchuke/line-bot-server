import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;

// Webhook
app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  if (events && events.length > 0) {
    const userId = events[0].source.userId;
    console.log("ユーザーID:", userId);
  }

  res.send("OK");
});

// Arduino → LINE
app.post("/arduino", async (req, res) => {
  const message = req.body.message || "Arduinoからの通知";

  // ここに送りたい userId を入れる（後で自動化もできる）
  const userId = "ここに送りたい userId";

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: userId,
      messages: [{ type: "text", text: message }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`
      }
    }
  );

  res.send("OK");
});

app.listen(3000, () => console.log("Server running"));
