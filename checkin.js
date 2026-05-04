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

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const cookies = parseCookies(COOKIE);

  console.log("🍪 parsed cookies:", cookies.length);

  if (!cookies.length) {
    console.log("❌ cookie empty");
    await browser.close();
    return;
  }

  await context.addCookies(cookies);

  const page = await context.newPage();

  console.log("🌐 STEP 1: goto checkin page");

  await page.goto('https://bbs.hupu.us/?v=checkin', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  // ===========================
  // 📦 READ BODY ONCE
  // ===========================
  const bodyText = await page.innerText('body').catch(() => '');

  console.log("📍 URL:", page.url());
  console.log("📄 TITLE:", await page.title());
  console.log("🧾 preview:", bodyText.slice(0, 200));

  // ===========================
  // 🔍 STATUS CHECK
  // ===========================
  const hasLoginPage =
    bodyText.includes("登录") || bodyText.includes("注册");

  const hasUsername =
    bodyText.includes("Tfboys_Yeah");

  const isCloudflare =
    bodyText.includes("Just a moment") ||
    bodyText.includes("Attention Required") ||
    bodyText.includes("Security verification");

  let status = "UNKNOWN";

  if (isCloudflare) {
    status = "BLOCKED (Cloudflare)";
  } else if (hasUsername) {
    status = "LOGGED IN";
  } else if (hasLoginPage) {
    status = "NOT LOGGED IN";
  } else {
    status = "GUEST OR LOADING";
  }

  console.log("📊 STATUS =", status);

  // ===========================
  // 🔬 DIAGNOSTIC BLOCK（核心）
  // ===========================
  const activeCookies = await context.cookies();
  console.log("🍪 ACTIVE COOKIES:", activeCookies.map(c => c.name));

  let diagnosis = "UNKNOWN";

  if (isCloudflare) {
    diagnosis = "❌ BLOCKED BY CLOUDFLARE";
  } else if (hasUsername) {
    diagnosis = "✅ LOGIN SUCCESS";
  } else if (hasLoginPage && activeCookies.length > 0) {
    diagnosis = "❌ COOKIE INVALID / EXPIRED";
  } else if (activeCookies.length === 0) {
    diagnosis = "❌ COOKIE NOT SET (FORMAT ISSUE)";
  } else {
    diagnosis = "⚠️ UNKNOWN STATE";
  }

  console.log("🧪 DIAGNOSIS:", diagnosis);

  // ❗只阻断 Cloudflare（其他情况允许继续用于 debug）
  if (status === "BLOCKED (Cloudflare)") {
    console.log("⛔ blocked by Cloudflare → exit");
    await browser.close();
    return;
  }

  // =========================
  // 🟡 CHECK ALREADY SIGNED
  // =========================
  if (bodyText.includes("已签")) {
    console.log("🟡 already checked in → exit");
    await browser.close();
    return;
  }

  console.log("🔍 STEP 2: click check-in");

  let success = false;

  try {
    await page.click('text=立刻签到', { timeout: 8000 });
    console.log("🟢 clicked check-in");
    success = true;
  } catch {
    console.log("⚠️ primary click failed, fallback...");
  }

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
    console.log("❌ no check-in button found");
    const html = await page.content();
    console.log("📄 HTML preview:", html.slice(0, 500));
    await browser.close();
    return;
  }

  // ===========================
  // ⏳ WAIT RESULT
  // ===========================
  console.log("⏳ waiting result...");
  await page.waitForTimeout(4000);

  const result = await page.innerText('body').catch(() => '');

  console.log("📄 RESULT:", result.slice(0, 200));

  if (result.includes("成功")) {
    console.log("✅ CHECK-IN SUCCESS");
  } else if (result.includes("已签")) {
    console.log("🟡 ALREADY CHECKED IN AFTER CLICK");
  } else {
    console.log("⚠️ UNKNOWN RESULT");
  }

  await browser.close();
})();
