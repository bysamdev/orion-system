from playwright.sync_api import sync_playwright
import time
import os

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        
        url = 'http://localhost:4175/?testAuth=true&testRole=admin'
        page.goto(url)
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        
        print("--- Test 1: Dark Mode ---")
        
        # Click dark mode
        page.locator('button', has=page.locator('svg.lucide-moon')).first.click()
        time.sleep(1)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/dark_mode_home.png')
        
        # SPA navigation
        page.evaluate("window.history.pushState({}, '', '/ajustes'); window.dispatchEvent(new Event('popstate'));")
        time.sleep(1)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/dark_mode_ajustes.png')

        page.evaluate("window.history.pushState({}, '', '/relatorios'); window.dispatchEvent(new Event('popstate'));")
        time.sleep(1)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/dark_mode_relatorios.png')

        page.evaluate("window.history.pushState({}, '', '/historico'); window.dispatchEvent(new Event('popstate'));")
        time.sleep(1)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/dark_mode_historico.png')

        print("Reloading page...")
        page.reload()
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/dark_mode_reload.png')
        
        # Test 2: New Ticket SLA
        print("\n--- Test 2: New Ticket SLA ---")
        page.goto('http://localhost:4175/novo-ticket?testAuth=true&testRole=admin')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        
        try:
            page.fill('input[name="titulo"]', 'Test SLA Medium P0')
            page.fill('textarea[name="descricao"]', 'This is a description with more than 15 chars to pass validation.')
            page.locator('button[role="combobox"]').nth(0).click()
            page.locator('div[role="option"]', has_text="Hardware").click()
            
            page.locator('button[role="combobox"]').nth(1).click()
            page.locator('div[role="option"]', has_text="Média").click()
            
            page.locator('button:has-text("Próximo")').first.click()
            time.sleep(1)
            page.locator('button:has-text("Criar Ticket")').first.click()
            time.sleep(2)
            page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/ticket_created.png')
            # Wait for redirect to dashboard or ticket
            time.sleep(3)
            page.goto('http://localhost:4175/?testAuth=true&testRole=admin')
            time.sleep(2)
            page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/ticket_sla_check.png', full_page=True)
        except Exception as e:
            print(f"Could not complete ticket creation: {e}")
        
        # Test 3: Ticket History
        print("\n--- Test 3: Ticket History ---")
        page.goto('http://localhost:4175/historico?testAuth=true&testRole=admin')
        time.sleep(2)
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/history_page1.png', full_page=True)
        
        next_btn = page.locator('button:has(svg.lucide-chevron-right)').first
        if next_btn.count() > 0:
            if not next_btn.is_disabled():
                next_btn.click()
                time.sleep(1)
                page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/history_page2.png', full_page=True)
        
        print("Done")
        browser.close()

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"Error: {e}")
