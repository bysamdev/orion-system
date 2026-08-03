import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('https://orion.bysam.dev/auth');
    await page.fill('input[type="email"]', 'tecnico@orionsystem.com');
    await page.fill('input[type="password"]', 'Mudar@123');
    await page.click('button[type="submit"]');
    
    // Wait a bit to see if an error toast appears
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scratch/error_login.png' });
    
  } finally {
    await browser.close();
  }
})();
