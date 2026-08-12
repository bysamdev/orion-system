import { chromium } from 'playwright';

(async () => {
  console.log("Testing production https://orion.bysam.dev/ ...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PROD CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PROD PAGE ERROR:', err.message));

  try {
    const response = await page.goto('https://orion.bysam.dev/', { waitUntil: 'networkidle' });
    console.log("PROD Status:", response.status());
    console.log("PROD Final URL:", page.url());
    console.log("PROD Title:", await page.title());

    // Check if redirect to /auth
    if (page.url().includes('/auth')) {
      console.log("PROD redirected to /auth properly.");
      // Check auth page title/heading
      const bodyText = await page.locator('body').innerText();
      console.log("PROD Auth Page Snippet:\n", bodyText.slice(0, 300));
    }
  } catch (err) {
    console.error("PROD ERROR:", err);
  } finally {
    await browser.close();
  }
})();
