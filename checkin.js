import { chromium } from 'playwright-extra';

const COOKIE = process.env.HUPU_COOKIE;

function parseCookies(str) {
  return str
    .replace(/\r?\n/g, '')
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(pair => {
      const i = pair.indexOf('=');
      if (i === -1) return null;

      return {
        name: pair.slice(0, i).trim(),
        value: pair.slice(i + 1).trim(),
        domain: '.bbs.hupu.us',
        path: '/',
        httpOnly: false,
        secure: true
      };
    })
    .filter(Boolean);
}

(async () => {
  console.log("🚀 START check-in bot");

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const cookies = parseCookies(COOKIE);

  console.log("🍪 cookies:", cookies.length);

  if (!cookies.length) {
    console.log("❌ cookie empty");
    await browser.close();
    process.exit(1);
  }

  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 STEP 1: goto");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  const url = page.url();
  console.log("📍 URL:", url);

  const body = await page.innerText('body').catch(() => '');

  console.log("🧾 preview:", body.slice(0, 200));

  // 🔥 已签到判断
  if (body.includes("已签到")) {
    console.log("🟡 already checked in");
    await browser.close();
    return;
  }

  console.log("🔍 STEP 2: click check-in");

  let success = false;

  // ✔ 最稳定方式：直接文本点击
  try {
    await page.click('text=立刻签到', { timeout: 8000 });
    console.log("🟢 clicked: 立刻签到");
    success = true;
  } catch (e) {
    console.log("⚠️ primary failed, fallback...");
  }

  // fallback：模糊匹配
  if (!success) {
    const els = await page.locator('button, a, div').all();

    for (const el of els.slice(0, 50)) {
      const t = await el.innerText().catch(() => '');
      if (t.includes("签到")) {
        await el.click().catch(() => {});
        console.log("🟢 fallback clicked:", t);
        success = true;
        break;
      }
    }
  }

  if (!success) {
    console.log("❌ no button found");
    const html = await page.content();
    console.log(html.slice(0, 800));
    await browser.close();
    process.exit(1);
  }

  console.log("⏳ waiting result...");

  await page.waitForTimeout(4000);

  const result = await page.innerText('body').catch(() => '');

  console.log("📄 RESULT:", result.slice(0, 200));

  if (result.includes("成功")) {
    console.log("✅ CHECK-IN SUCCESS");
  } else if (result.includes("已签到")) {
    console.log("🟡 ALREADY DONE");
  } else {
    console.log("⚠️ UNKNOWN RESULT");
  }

  await browser.close();
})();
