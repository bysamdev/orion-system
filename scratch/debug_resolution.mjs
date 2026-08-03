import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:8081/auth');
  await page.fill('input[type="email"]', 'samterres42@gmail.com');
  await page.fill('input[type="password"]', '!oivelox2004');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto('http://localhost:8081/tickets/1141');
  await page.waitForSelector('text="Resolver"');
  
  await page.click('button:has-text("Resolver")');
  await page.waitForSelector('div[role="alertdialog"]', { state: 'visible' });

  await page.fill('#resolution-notes', 'TEST RESOLUTION NOTES');
  await page.waitForTimeout(500);

  // Click confirm
  await page.click('button:has-text("Confirmar")');

  // Wait to see if it closes or toasts
  await page.waitForTimeout(2000);

  const toasts = await page.locator('.toast').allInnerTexts();
  console.log('Toasts:', toasts);
  
  const textVal = await page.inputValue('#resolution-notes').catch(() => 'Modal Closed');
  console.log('Textarea Value:', textVal);

  await browser.close();
})();
