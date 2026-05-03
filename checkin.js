import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

if (!COOKIE) {
  console.error("❌ Missing HUPU_COOKIE");
  process.exit(1);
}

// 🧠 超稳定 cookie 解析器（防换行 + 防污染 + 防 Value:）
function parseCookies(cookieStr) {
  return cookieStr
    // 🧹 彻底清理换行 / 回车
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

      // 🧹 防止日志污染（你刚才的 bug 来源）
      name = name.replace(/^.*Value:\s*/i, '');
      value = value.replace(/^Value:\s*/i, '');

      if (!name || !value) return null;

      return {
        name,
        value,
        domain: '.bbs.hupu.us',   // ⚠️ 必须带点
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      };
    })
    .filter(Boolean);
}

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext();

  const cookies = parseCookies(COOKIE);

  console.log("🍪 cookies parsed:", cookies.length);

  // 🔍 debug（如果这里是 0 就说明 cookie 有问题）
  console.log("sample cookie:", cookies[0]);

  // 🧠 注入 cookie
  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 Opening site...");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'networkidle'
  });

  console.log("📍 Trying check-in...");

  try {
    await page.click('text=立刻签到', { timeout: 5000 });
  } catch (e) {
    console.log("⚠️ fallback clicking...");

    // fallback（页面结构变化时）
    await page.click('body');
    await page.click('text=立刻签到');
  }

  await page.waitForTimeout(3000);

  const html = await page.content();

  if (html.includes("success") || html.includes("成功")) {
    console.log("✅ Check-in SUCCESS");
  } else if (html.includes("already") || html.includes("已签到")) {
    console.log("🟡 Already checked in today");
  } else {
    console.log("❓ Unknown result (check page change or login)");
  }

  await browser.close();
})();
