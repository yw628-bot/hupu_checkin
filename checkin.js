function parseCookies(cookieStr) {
  return cookieStr
    // 🧹 清理所有换行 & 多余空格
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim()
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;

      let name = pair.slice(0, idx).trim();
      let value = pair.slice(idx + 1).trim();

      // 🚨 强清洗：防止 Value: xxx 混入
      name = name.replace(/^.*Value:\s*/i, '');
      value = value.replace(/^Value:\s*/i, '');

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
