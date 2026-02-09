import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ------------------------------
// Supabase
// ------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ------------------------------
// LINE Bot
// ------------------------------
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ------------------------------
// Yahoo!天気 API
// ------------------------------
const APP_ID = process.env.YAHOO_APP_ID;
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET;

// Yahoo!天気を取得して説明文を作る関数
async function getYahooWeather() {
  const url =
    "https://weather-ydn-yql.media.yahoo.com/forecastrss?location=sapporo&format=json";

  const method = "GET";
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const params = {
    oauth_consumer_key: CLIENT_ID,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
  };

  const signatureBase = [
    method,
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&")
    ),
  ].join("&");

  const signingKey = `${CLIENT_SECRET}&`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  const authHeader =
    "OAuth " +
    Object.keys(params)
      .map((k) => `${k}="${params[k]}"`)
      .join(", ") +
    `, oauth_signature="${signature}"`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "X-Yahoo-App-Id": APP_ID,
    },
  });

  const data = await res.json();

  const weather = data.current_observation.condition.text;
  const temp = data.current_observation.condition.temperature;
  const humidity = data.current_observation.atmosphere.humidity;

  const now = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  const message =
    `【今日の札幌の天気（Yahoo!天気）】\n` +
    `天気：${weather}\n` +
    `気温：${temp}℃\n` +
    `湿度：${humidity}%\n\n` +
    `送信時刻：${now}`;

  return message;
}

// ------------------------------
// LINE pushMessage
// ------------------------------
async function pushMessage(userId, text) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }],
    }),
  });
}

// ------------------------------
// Webhook（友だち追加 → userId 保存）
// ------------------------------
app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    const userId = event.source.userId;

    if (event.type === "follow") {
      await supabase.from("users").upsert({ id: userId });
      console.log("ユーザー登録:", userId);

      await pushMessage(userId, "友だち追加ありがとう！天気通知を受け取れるようになりました。");
    }
  }

  res.sendStatus(200);
});

// ------------------------------
// Arduino → Render → LINE（天気送信）
// ------------------------------
app.post("/notify", async (req, res) => {
  const weatherMessage = await getYahooWeather();

  const { data: users } = await supabase.from("users").select("id");

  for (const u of users) {
    await pushMessage(u.id, weatherMessage);
  }

  res.json({ status: "ok" });
});

// ------------------------------
app.listen(3000, () => {
  console.log("Server running");
});

