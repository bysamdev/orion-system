import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const takeScreenshot = async (name) => {
    const path = `/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/${name}.png`;
    await page.screenshot({ path });
    console.log(`Screenshot saved: ${path}`);
  };

  try {
    // Test 2
    await page.goto('http://localhost:4175/novo?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="title"]', '123');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);
    await page.fill('input[name="title"]', '123456');
    await page.waitForTimeout(500);
    await takeScreenshot("test2_title_validation");

    // Test 3
    await page.goto('http://localhost:4175/historico?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="Pesquisar histórico..."]', 'ticket');
    await page.waitForTimeout(1000);
    await takeScreenshot("test3_history_singular");

    // Test 4
    await page.goto('http://localhost:4175/?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder*="Buscar tickets"]', 'ticket');
    await page.waitForTimeout(2000);
    await takeScreenshot("test4_global_search_badge");

    console.log("ALL_DONE");
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
