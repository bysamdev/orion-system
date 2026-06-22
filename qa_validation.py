from playwright.sync_api import sync_playwright
import time
import os

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        # Helper to take screenshot
        def take_screenshot(name):
            path = f"/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/{name}.png"
            page.screenshot(path=path)
            print(f"Screenshot saved: {path}")

        print("Starting QA Validations...")
        
        # Login if needed (assuming local dev server might auto-login or have a test user)
        # Let's check if we are redirected to /auth
        page.goto('http://localhost:4175/')
        page.wait_for_load_state('networkidle')
        
        if "/auth" in page.url:
            print("Needs login, attempting default login if any or skipping to public routes...")
            # If there's an auth form, we might need to fill it
            try:
                page.fill('input[type="email"]', 'samterres42@gmail.com')
                page.fill('input[type="password"]', 'password') # Guess or just wait if session exists
                page.click('button[type="submit"]')
                page.wait_for_load_state('networkidle')
            except Exception as e:
                print("Login failed or not needed:", e)

        time.sleep(2) # Extra wait for dashboard to render

        # Validation 6: Placeholder da busca está completo e legível
        print("\n--- Test 6: Global Search Placeholder ---")
        try:
            placeholder = page.locator('input[placeholder*="Buscar tickets"]').get_attribute('placeholder')
            if placeholder == "Buscar tickets por #número, título ou cliente...":
                print("✅ Placeholder is complete: " + placeholder)
            else:
                print("❌ Placeholder is incorrect: " + str(placeholder))
            take_screenshot("test6_placeholder")
        except Exception as e:
            print("❌ Failed Test 6:", e)

        # Validation 7: Notificações abre página dedicada, não popover
        print("\n--- Test 7: Notifications Navigation ---")
        try:
            # Click Notifications button in sidebar
            page.click('button:has-text("Notificações")')
            page.wait_for_load_state('networkidle')
            time.sleep(1)
            if "/notificacoes" in page.url:
                print("✅ Navigated to /notificacoes")
            else:
                print(f"❌ Did not navigate, current URL: {page.url}")
            take_screenshot("test7_notifications")
        except Exception as e:
            print("❌ Failed Test 7:", e)

        # Validation 1: Clicar na aba Integrações não preenche mais a busca global
        print("\n--- Test 1: Global search autocomplete isolation ---")
        try:
            page.goto('http://localhost:4175/configuracoes')
            page.wait_for_load_state('networkidle')
            
            # Click the Integrações tab
            page.click('button:has-text("Integrações")')
            time.sleep(1)
            
            search_val = page.locator('input[placeholder*="Buscar tickets"]').input_value()
            if search_val == "":
                print("✅ Global search is empty")
            else:
                print(f"❌ Global search has text: '{search_val}'")
            take_screenshot("test1_integracoes_search")
        except Exception as e:
            print("❌ Failed Test 1:", e)

        # Validation 2: Título do ticket: erro desaparece ao digitar 5+ caracteres
        print("\n--- Test 2: Ticket Title Validation ---")
        try:
            page.goto('http://localhost:4175/novo')
            page.wait_for_load_state('networkidle')
            
            # Type less than 5
            page.fill('input[name="title"]', '1234')
            page.click('body') # blur
            time.sleep(0.5)
            # Find next button to trigger validation maybe
            page.click('button:has-text("Próximo")')
            time.sleep(0.5)
            error_text = page.locator('text="mínimo 5 caracteres"').count()
            has_error_initial = error_text > 0
            
            # Type more
            page.fill('input[name="title"]', '123456')
            time.sleep(0.5) # Wait for onChange
            error_text_after = page.locator('text="mínimo 5 caracteres"').count()
            
            if has_error_initial and error_text_after == 0:
                print("✅ Error disappeared after 5+ chars")
            else:
                print(f"❌ Error logic failed. Initial: {has_error_initial}, After: {error_text_after}")
            take_screenshot("test2_title_validation")
        except Exception as e:
            print("❌ Failed Test 2:", e)

        # Validation 3: Histórico mostra "1 resultado" (singular) corretamente
        print("\n--- Test 3: History Singular Plural ---")
        try:
            page.goto('http://localhost:4175/historico')
            page.wait_for_load_state('networkidle')
            
            # Filter to get 1 result. Let's just search for a specific ticket number that exists
            # Try typing 1069
            page.fill('input[placeholder*="Buscar"]', '1069')
            time.sleep(1)
            
            # Check footer text
            text = page.locator('text="MOSTRANDO 1 RESULTADO"').count()
            if text > 0:
                print("✅ Singular '1 resultado' found")
            else:
                print("❌ Singular text not found, might have multiple or different text.")
            take_screenshot("test3_history_singular")
        except Exception as e:
            print("❌ Failed Test 3:", e)

        # Validation 4: Busca global mostra "Em Andamento"
        print("\n--- Test 4: Global Search Badge Translation ---")
        try:
            page.goto('http://localhost:4175/')
            page.wait_for_load_state('networkidle')
            
            # Search for a ticket that is in-progress, or just trigger search
            page.fill('input[placeholder*="Buscar tickets"]', '1') # Type something to show results
            time.sleep(1)
            
            in_progress_en = page.locator('text="IN-PROGRESS"').count()
            in_progress_pt = page.locator('text="Em Andamento"').count()
            
            if in_progress_en == 0 and in_progress_pt > 0:
                print("✅ Found 'Em Andamento', no 'IN-PROGRESS'")
            elif in_progress_en > 0:
                print("❌ Found 'IN-PROGRESS' in English")
            else:
                print("⚠️ No in-progress tickets found to verify, but checking screenshot")
            take_screenshot("test4_global_search_badge")
        except Exception as e:
            print("❌ Failed Test 4:", e)

        # Validation 5: Dispositivo offline há mais de 1h gera alerta na Central
        print("\n--- Test 5: Offline device alert ---")
        try:
            page.goto('http://localhost:4175/monitoramento')
            page.wait_for_load_state('networkidle')
            
            # Look for alert text
            alert_count = page.locator('text="offline há mais de"').count()
            if alert_count > 0:
                print("✅ Found offline alert")
            else:
                print("⚠️ No offline alert text found in DOM")
            take_screenshot("test5_offline_alert")
        except Exception as e:
            print("❌ Failed Test 5:", e)

        browser.close()

if __name__ == "__main__":
    run_tests()
