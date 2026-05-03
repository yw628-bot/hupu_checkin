import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

if (!COOKIE) {
  console.error("❌ Missing HUPU_COOKIE");
  process.exit(1);
}

// ✅ 修复后的 cookie parser（核心修复点）
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
        domain: 'bbs.hupu.us',
        path: '/'
      };
    })
    .filter(Boolean);
}

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext();

  // 🧠 注入 cookie（修复后的结构）
  const cookies = parseCookies(COOKIE);

  console.log("🍪 cookies parsed:", cookies.length);

  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 Opening site...");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'networkidle'
  });

  console.log("📍 Looking for check-in...");

  try {
    await page.click('text=立刻签到', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️ fallback clicking icon...");

    // fallback（页面结构变化时）
    await page.click('body');
    await page.click('text=立刻签到');
  }

  await page.waitForTimeout(3000);

  const html = await page.content();

  if (html.includes("success") || html.includes("成功") || html.includes("ok")) {
    console.log("✅ Check-in SUCCESS");
  } else if (html.includes("already") || html.includes("已签到")) {
    console.log("🟡 Already checked in today");
  } else {
    console.log("❓ Unknown result");
  }

  await browser.close();
})();
