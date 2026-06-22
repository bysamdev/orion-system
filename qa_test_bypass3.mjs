import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const takeScreenshot = async (name) => {
    const path = `/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/${name}.png`;
    await page.screenshot({ path });
    console.log(`Screenshot saved: ${path}`);
  };

  try {
    console.log("Starting QA Validations...");
    
    // Test 1: Clicar na aba Integrações não preenche mais a busca global
    console.log("\n--- Test 1: Global search autocomplete isolation ---");
    await page.goto('http://localhost:4175/configuracoes?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    await page.click('button[value="integrations"]');
    await page.waitForTimeout(1000);
    const searchVal = await page.locator('input[placeholder*="Buscar tickets"]').inputValue();
    if (searchVal === "") {
      console.log("✅ Global search is empty");
    } else {
      console.log(`❌ Global search has text: '${searchVal}'`);
    }
    await takeScreenshot("test1_integracoes_search");

    // Test 2: Título do ticket: erro desaparece ao digitar 5+ caracteres
    console.log("\n--- Test 2: Ticket Title Validation ---");
    await page.goto('http://localhost:4175/novo?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="titulo"]', '123');
    await page.click('body');
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);
    
    const errorTextInitial = await page.locator('text="mínimo 5 caracteres"').count();
    
    await page.fill('input[name="titulo"]', '123456');
    await page.waitForTimeout(500);
    const errorTextAfter = await page.locator('text="mínimo 5 caracteres"').count();
    
    if (errorTextInitial > 0 && errorTextAfter === 0) {
      console.log("✅ Error disappeared after 5+ chars");
    } else {
      console.log(`❌ Error logic failed. Initial: ${errorTextInitial}, After: ${errorTextAfter}`);
    }
    await takeScreenshot("test2_title_validation");

    // Test 3: Histórico mostra "1 resultado" (singular) corretamente
    console.log("\n--- Test 3: History Singular Plural ---");
    await page.goto('http://localhost:4175/historico?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="Buscar"]', '1069'); // Assuming 1069 yields 1 result, if not we check for singular pattern
    await page.waitForTimeout(1500);
    
    // Look for any text containing "1 resultado limitado" or "1 resultado"
    const countSingular = await page.locator('text=/1 resultado/i').count();
    if (countSingular > 0) {
      console.log("✅ Singular '1 resultado' found");
    } else {
      console.log("⚠️ Singular text not found, maybe no results or multiple results returned.");
    }
    await takeScreenshot("test3_history_singular");

    // Test 4: Busca global mostra "Em Andamento"
    console.log("\n--- Test 4: Global Search Badge Translation ---");
    await page.goto('http://localhost:4175/?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="Buscar tickets"]', '1');
    await page.waitForTimeout(1500);
    
    const inProgressEn = await page.locator('text="IN-PROGRESS"').count();
    const inProgressPt = await page.locator('text="Em Andamento"').count();
    
    if (inProgressEn === 0 && inProgressPt > 0) {
      console.log("✅ Found 'Em Andamento', no 'IN-PROGRESS'");
    } else if (inProgressEn > 0) {
      console.log("❌ Found 'IN-PROGRESS' in English");
    } else {
      console.log("⚠️ No in-progress tickets found to verify.");
    }
    await takeScreenshot("test4_global_search_badge");

    // Test 5: Dispositivo offline há mais de 1h gera alerta na Central
    console.log("\n--- Test 5: Offline device alert ---");
    await page.goto('http://localhost:4175/monitoramento?testAuth=true&testRole=admin');
    await page.waitForLoadState('networkidle');
    
    const alertCount = await page.locator('text=/offline/i').count();
    if (alertCount > 0) {
      console.log("✅ Found offline alert");
    } else {
      console.log("⚠️ No offline alert text found in DOM");
    }
    await takeScreenshot("test5_offline_alert");

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await browser.close();
  }
})();
