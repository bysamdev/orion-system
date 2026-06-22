from playwright.sync_api import sync_playwright
import time

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        
        # Test 2: New Ticket SLA
        print("\n--- Test 2: New Ticket SLA ---")
        page.goto('http://localhost:4175/novo-ticket?testAuth=true&testRole=admin')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        
        try:
            # Step 1
            page.locator('button', has_text="Hardware").first.click()
            page.fill('input[name="title"]', 'Test SLA Medium P0')
            page.locator('button:has-text("Próximo")').first.click()
            time.sleep(1)
            
            # Step 2
            page.fill('textarea[name="description"]', 'This is a description with more than 15 chars to pass validation.')
            page.locator('button[role="combobox"]').nth(0).click()
            page.locator('div[role="option"]', has_text="Média").click()
            page.locator('button:has-text("Próximo")').first.click()
            time.sleep(1)
            
            # Step 3
            page.locator('button:has-text("Abrir Chamado")').first.click()
            time.sleep(2)
            
            # Navigate to Dashboard
            page.goto('http://localhost:4175/?testAuth=true&testRole=admin')
            time.sleep(2)
            page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/ticket_sla_check.png', full_page=True)
        except Exception as e:
            print(f"Could not complete ticket creation: {e}")
            page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/error_test2.png')
        
        browser.close()

if __name__ == "__main__":
    run_tests()
