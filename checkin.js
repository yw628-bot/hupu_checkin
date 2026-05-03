import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

if (!COOKIE) {
  console.error("❌ Missing HUPU_COOKIE");
  process.exit(1);
}

// ✅ 强化版 cookie parser（修复 domain + filter）
function parseCookies(cookieStr) {
  return cookieStr
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
        domain: '.bbs.hupu.us',   // ⭐⭐⭐ 关键修复点
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      };
    })
    .filter(Boolean);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const cookies = parseCookies(COOKIE);

  console.log("🍪 cookies parsed:", cookies.length);

  // 🔍 debug（很重要）
  console.log("sample cookie:", cookies[0]);

  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 Opening site...");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'networkidle'
  });

  console.log("📍 Clicking check-in...");

  try {
    await page.click('text=立刻签到', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️ fallback click...");
    await page.click('body');
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
