import "dotenv/config";
import { Bot, Context, InputFile } from "grammy";
import { runAgent } from "../agent/index.js";

export const bot = new Bot(
  process.env.TELEGRAM_BOT_TOKEN!
);

function getOwnerKey(ctx: Context): string {
  return String(
    ctx.from?.id ??
    ctx.chat?.id ??
    "telegram-user"
  );
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "🛒 Welcome to Nebula Kirana!\n\n" +
    "I can help you with:\n" +
    "• Stock & inventory\n" +
    "• Billing\n" +
    "• Khata / credit\n" +
    "• Daily close\n" +
    "• Invoices\n" +
    "• Sales analysis\n\n" +
    "Try:\n" +
    "\"show me all products\"\n" +
    "\"show low stock items\"\n" +
    "\"create a bill for 2 Maggi and 1 Tata Salt\""
  );
});

bot.command("new", async (ctx) => {
  await ctx.reply(
    "🆕 Started a fresh conversation."
  );
});

bot.on("message:text", async (ctx) => {
  try {
    const message = ctx.message.text.trim();

    if (!message) {
      return;
    }

    console.log(
      `[Telegram] ${ctx.from?.id}: ${message}`
    );

    const result = await runAgent(
      message,
      getOwnerKey(ctx)
    );

    console.log(
      "[Agent response]:",
      result.text
    );

    const response = result.text?.trim();

    if (response) {
      await ctx.reply(response);
    } else {
      await ctx.reply(
        "✅ Done. The requested operation was completed."
      );
    }

    if (result.artifactPath) {
      await ctx.replyWithDocument(
        new InputFile(result.artifactPath)
      );
    }

  } catch (error) {
    console.error(
      "[Telegram Error]",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    await ctx.reply(
      `❌ Could not complete that:\n${errorMessage}`
    );
  }
});

bot.catch((err) => {
  console.error(
    "[Bot Error]",
    err.error
  );
});