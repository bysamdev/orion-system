import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  try {
    console.log('Navigating to portal as Technician...');
    await page.goto('https://orion.bysam.dev/auth');
    
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'samterres42@gmail.com');
    await page.fill('input[type="password"]', '!oivelox2004');
    await page.click('button[type="submit"]');
    
    // Technician goes to / 
    await page.waitForURL('https://orion.bysam.dev/', { timeout: 10000 });
    console.log('Successfully logged in and redirected to Dashboard');

    console.log('Looking for our ticket...');
    // Type in search bar to easily find the ticket
    await page.fill('input[placeholder="Busque por #número, título ou cliente..."]', 'roteador da recepção');
    await page.waitForTimeout(1000); // Wait for debounce and filter

    await page.screenshot({ path: 'after_search_j2.png', fullPage: true });
    
    console.log('Clicking on the ticket...');
    // We can also click the first ticket in the list if the text match fails
    await page.click('tr.cursor-pointer'); // click the first table row that is clickable

    console.log('Waiting for ticket details page to load...');
    await page.waitForURL('**/ticket/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    console.log('Clicking "Resolver" button in action bar...');
    await page.click('button:has-text("Resolver")');

    console.log('Filling resolution notes...');
    // The resolution modal has a textarea.
    const textareaSelector = '#resolution-notes';
    await page.waitForSelector(textareaSelector, { state: 'visible' });
    await page.fill(textareaSelector, 'O problema do roteador foi resolvido com uma atualização de firmware.');
    // add small delay to ensure React state updates
    await page.waitForTimeout(500);

    console.log('Clicking "Confirmar"...');
    // There are multiple "Confirmar" buttons on the page potentially, but in the dialog it should be unique enough, or we use a more specific selector
    await page.click('button:has-text("Confirmar")');
    console.log('Waiting for modal to close...');
    await page.waitForSelector('div[role="alertdialog"]', { state: 'hidden', timeout: 5000 });

    await page.screenshot({ path: 'after_resolve_j2.png', fullPage: true });

    console.log('Waiting for success...');
    // We should be able to see the status badge update to "Resolvido"
    // Progress bar has text="Resolvido", but we want to check the badge!
    await page.waitForSelector('div.bg-emerald-500:has-text("Resolvido")', { state: 'visible', timeout: 5000 });
    
    console.log('JOURNEY 2 PASSED.');
    
  } catch (error) {
    console.error('Error in Journey 2:', error);
    await page.screenshot({ path: 'scratch/error_journey2.png' });
  } finally {
    await browser.close();
  }
})();
