import { chromium } from 'playwright';

const COOKIE = process.env.HUPU_COOKIE;

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

      return {
        name: pair.slice(0, idx).trim(),
        value: pair.slice(idx + 1).trim(),
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
  console.log("🚀 START");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies(parseCookies(COOKIE));

  const page = await context.newPage();

  console.log("🌐 STEP 1: goto site");

  await page.goto('https://bbs.hupu.us', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // 🧠 ① 页面状态信息（关键新增）
  console.log("📍 CURRENT URL:", page.url());

  const title = await page.title();
  console.log("📄 TITLE:", title);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log("🧾 PAGE SNIPPET:", bodyText.slice(0, 300));

  console.log("⏳ STEP 2: detect login/check-in state");

  // 🧠 ② 已签到判断（提前识别）
  if (
    bodyText.includes("已签到") ||
    bodyText.includes("already") ||
    bodyText.includes("连续签到") ||
    bodyText.includes("积分")
  ) {
    console.log("🟡 ALREADY CHECKED IN (detected early)");
    await browser.close();
    return;
  }

  console.log("🔍 STEP 3: searching all clickable elements...");

  // 🧠 ③ 不再只找“立刻签到”，改为全扫描
  const candidates = await page.locator('button, a, div').all();

  let clicked = false;

  for (const el of candidates.slice(0, 50)) {
    const text = (await el.innerText().catch(() => '')).trim();

    if (!text) continue;

    // debug输出前20个可点击元素
    if (!clicked) {
      console.log("🔎 FOUND ELEMENT:", text);
    }

    if (
      text.includes("签到") ||
      text.includes("立刻") ||
      text.includes("check") ||
      text.includes("签到奖励")
    ) {
      console.log("🟢 CLICK TARGET FOUND:", text);

      await el.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log("❌ NO CHECK-IN BUTTON FOUND");
    console.log("📸 dumping page html for debugging...");

    const html = await page.content();
    console.log(html.slice(0, 1000));

    await browser.close();
    process.exit(1);
  }

  console.log("⏳ STEP 4: waiting result...");
  await page.waitForTimeout(3000);

  const finalText = await page.innerText('body').catch(() => '');

  console.log("📄 RESULT TEXT:", finalText.slice(0, 300));

  if (finalText.includes("成功") || finalText.includes("success")) {
    console.log("✅ CHECK-IN SUCCESS");
  } else if (finalText.includes("已签到")) {
    console.log("🟡 ALREADY CHECKED IN");
  } else {
    console.log("❓ UNKNOWN RESULT");
  }

  await browser.close();
})();
