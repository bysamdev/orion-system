import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to portal...');
    await page.goto('https://orion.bysam.dev/auth');
    
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'usuario@orionsystem.com');
    await page.fill('input[type="password"]', 'Mudar@123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/portal', { timeout: 10000 });
    console.log('Successfully logged in and redirected to /portal');
    
    console.log('Opening new ticket...');
    await page.goto('https://orion.bysam.dev/novo-ticket');
    await page.waitForLoadState('networkidle');

    console.log('Step 1...');
    await page.click('button:has-text("Hardware")');
    const titleInput = page.locator('input[name="title"]');
    await titleInput.fill('Problema com o roteador da recepção'); // Change title so it's fresh
    console.log('Clicking Próximo (to step 2)...');
    await page.click('button:has-text("Próximo")');

    console.log('Step 2...');
    const descInput = page.locator('textarea[name="description"]');
    await descInput.fill('O roteador da recepção está apresentando instabilidade desde ontem à tarde.');

    const priorityCombobox = page.locator('button[role="combobox"]').nth(0);
    if(await priorityCombobox.isVisible()) {
        console.log('Selecting priority...');
        await priorityCombobox.click();
        await page.click('div[role="option"]:has-text("Alta")');
    }

    console.log('Clicking Próximo (to step 3)...');
    await page.click('button:has-text("Próximo")');

    console.log('Step 3...');
    console.log('Submitting ticket...');
    await page.click('button:has-text("Abrir Chamado")');

    // It should now show "Chamado criado!" with an "Acompanhar Chamado" button or we can just go to /portal
    // Wait for the button on the success screen
    await page.waitForSelector('text="Acompanhar Chamado"', { timeout: 10000 });
    console.log('Ticket successfully created (success screen visible).');
    
    console.log('Going back to portal home...');
    await page.goto('https://orion.bysam.dev/portal');
    
    console.log('Waiting for the ticket to appear in recent activity...');
    await page.waitForSelector('text="Problema com o roteador da recepção"', { state: 'visible', timeout: 5000 });
    console.log('Ticket successfully found in Atividade Recente!');
    console.log('JOURNEY 1 PASSED.');
    
  } catch (error) {
    console.error('Error in Journey 1:', error);
  } finally {
    await browser.close();
  }
})();
