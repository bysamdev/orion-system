import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:8081');
  console.log("Navigated to localhost:8081");
  
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'samterres42@gmail.com');
  await page.type('input[type="password"]', '!oivelox2004');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log("Logged in");
  
  // Go to a ticket
  const ticketLinks = await page.$$('a[href^="/ticket/"]');
  if (ticketLinks.length === 0) {
    console.log("No tickets found");
    await browser.close();
    return;
  }
  
  await ticketLinks[0].click();
  await page.waitForSelector('h3:has-text("Status Atual")');
  console.log("Opened ticket");
  
  // Click Resolve
  const buttons = await page.$$('button');
  let resolveBtn;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Resolver')) {
      resolveBtn = btn;
      break;
    }
  }
  
  if (resolveBtn) {
    await resolveBtn.click();
    console.log("Clicked resolver button");
    
    await page.waitForSelector('#resolution-notes');
    await page.type('#resolution-notes', 'This is a resolution note with more than twenty characters to test.');
    console.log("Typed resolution note");
    
    // Check characters
    const charCount = await page.evaluate(() => {
      const p = Array.from(document.querySelectorAll('p')).find(p => p.textContent.includes('caracteres'));
      return p ? p.textContent : 'Not found';
    });
    console.log("Char count:", charCount);
    
    // Find Confirmar button
    const confirmBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Confirmar'));
    });
    
    await confirmBtn.click();
    console.log("Clicked confirmar");
    
    await page.waitForTimeout(1000); // Wait for toast
  }
  
  await browser.close();
})();
