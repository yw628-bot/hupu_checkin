import { chromium } from 'playwright-extra';
import stealth from 'playwright-extra-plugin-stealth';

chromium.use(stealth());

const COOKIE = process.env.HUPU_COOKIE;

/**
 * 🧠 Cookie 清洗（防换行 / 防污染）
 */
function parseCookies(cookieStr) {
  return cookieStr
    .replace(/\r?\n|\r/g, '')
    .trim()
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;

      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();

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
  console.log("🚀 [START] Hupu check-in bot");

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

    viewport: { width: 1280, height: 800 },
    locale: 'en-US'
  });

  const cookies = parseCookies(COOKIE);

  console.log("🍪 cookies parsed:", cookies.length);

  if (cookies.length === 0) {
    console.log("❌ invalid cookies");
    await browser.close();
    process.exit(1);
  }

  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 STEP 1: goto site");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  console.log("📍 URL:", page.url());

  await page.waitForTimeout(5000);

  const bodyText = await page.innerText('body').catch(() => '');

  console.log("🧾 page preview:", bodyText.slice(0, 200));

  /**
   * 🟡 已签到检测
   */
  if (
    bodyText.includes("已签到") ||
    bodyText.includes("already") ||
    bodyText.includes("连续签到")
  ) {
    console.log("🟡 already checked in");
    await browser.close();
    return;
  }

  console.log("🔍 STEP 2: searching button...");

  let clicked = false;

  // 优先精确点击
  try {
    await page.click('text=立刻签到', { timeout: 8000 });
    console.log("🟢 clicked: 立刻签到");
    clicked = true;
  } catch (e) {
    console.log("⚠️ primary selector failed, fallback scanning...");
  }

  // fallback：扫描所有元素
  if (!clicked) {
    const elements = await page.locator('button, a, div').all();

    for (const el of elements.slice(0, 60)) {
      const text = await el.innerText().catch(() => '');

      if (text.includes("签到")) {
        console.log("🟢 fallback click:", text);
        await el.click().catch(() => {});
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    console.log("❌ no check-in button found");
    const html = await page.content();
    console.log(html.slice(0, 1000));
    await browser.close();
    process.exit(1);
  }

  console.log("⏳ STEP 3: waiting result...");
  await page.waitForTimeout(3000);

  const resultText = await page.innerText('body').catch(() => '');

  console.log("📄 RESULT:", resultText.slice(0, 200));

  if (resultText.includes("成功")) {
    console.log("✅ CHECK-IN SUCCESS");
  } else if (resultText.includes("已签到")) {
    console.log("🟡 ALREADY CHECKED IN");
  } else {
    console.log("❓ UNKNOWN RESULT");
  }

  await browser.close();
})();
