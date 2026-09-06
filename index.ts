import "dotenv/config";
import { bot } from "./telegram/bot.js";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN missing");
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY missing");
}

console.log("Starting Nebula Supermarket Ops Agent...");

bot.start({
  onStart: (info) => {
    console.log(`Telegram bot started: @${info.username}`);
  },
});