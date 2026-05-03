import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

if (!COOKIE) {
  console.error("❌ Missing HUPU_COOKIE");
  process.exit(1);
}

function parseCookies(cookieStr) {
  return cookieStr.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return {
      name,
      value: rest.join('='),
      domain: '.bbs.hupu.us',
      path: '/'
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies(parseCookies(COOKIE));

  const page = await context.newPage();

  console.log("🌐 Opening site...");
  await page.goto('https://bbs.hupu.us', { waitUntil: 'networkidle' });

  console.log("📍 Clicking checkin...");

  try {
    await page.click('text=立刻签到', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️ fallback clicking icon...");
    await page.click('div');
    await page.click('text=立刻签到');
  }

  await page.waitForTimeout(3000);

  const html = await page.content();

  if (html.includes("success") || html.includes("成功")) {
    console.log("✅ Check-in SUCCESS");
  } else if (html.includes("already") || html.includes("已签到")) {
    console.log("🟡 Already checked in");
  } else {
    console.log("❓ Unknown result");
  }

  await browser.close();
})();
