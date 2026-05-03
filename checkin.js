import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

if (!COOKIE) {
  console.error("❌ [INIT] Missing HUPU_COOKIE");
  process.exit(1);
}

/**
 * 🧠 Cookie 清洗 + Playwright 合规解析
 */
function parseCookies(cookieStr) {
  console.log("🧹 [STEP 1] Parsing cookies...");

  return cookieStr
    .replace(/\r?\n|\r/g, '')
    .trim()
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;

      let name = pair.slice(0, idx).trim();
      let value = pair.slice(idx + 1).trim();

      if (!name || !value) return null;

      return {
        name,
        value,
        domain: '.bbs.hupu.us',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      };
    })
    .filter(Boolean);
}

(async () => {
  console.log("🚀 [START] Hupu check-in bot starting...");

  const browser = await chromium.launch({
    headless: true
  });

  console.log("🧠 [STEP 2] Browser launched");

  const context = await browser.newContext();

  const cookies = parseCookies(COOKIE);

  console.log(`🍪 [STEP 3] Parsed cookies count: ${cookies.length}`);

  if (cookies.length === 0) {
    console.error("❌ No valid cookies parsed");
    await browser.close();
    process.exit(1);
  }

  console.log("📦 [STEP 4] Injecting cookies...");
  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 [STEP 5] Navigating to site...");

  try {
    await page.goto('https://bbs.hupu.us', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log("✅ [STEP 5] Page loaded");
  } catch (err) {
    console.error("❌ [STEP 5] Page load failed:", err.message);
    await browser.close();
    process.exit(1);
  }

  console.log("⏳ [STEP 6] Waiting for page stability...");
  await page.waitForTimeout(3000);

  console.log("🔍 [STEP 7] Searching check-in button...");

  try {
    await page.click('text=立刻签到', { timeout: 8000 });
    console.log("🟢 [STEP 7] Clicked check-in button");
  } catch (e) {
    console.log("⚠️ [STEP 7] Primary button not found, trying fallback...");

    try {
      await page.click('body');
      await page.click('text=立刻签到');
      console.log("🟢 [STEP 7] Fallback click success");
    } catch (err) {
      console.error("❌ [STEP 7] Failed to click check-in button");
      await browser.close();
      process.exit(1);
    }
  }

  console.log("⏳ [STEP 8] Waiting for response...");
  await page.waitForTimeout(3000);

  const html = await page.content();

  console.log("📄 [STEP 9] Checking result...");

  if (html.includes("success") || html.includes("成功") || html.includes("ok")) {
    console.log("✅ [RESULT] Check-in SUCCESS");
  } else if (html.includes("already") || html.includes("已签到")) {
    console.log("🟡 [RESULT] Already checked in today");
  } else {
    console.log("❓ [RESULT] Unknown result (need inspect page)");
  }

  console.log("🏁 [DONE] Closing browser...");
  await browser.close();
})();
