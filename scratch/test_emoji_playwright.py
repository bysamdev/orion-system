import os, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
ADMIN_EMAIL = "samterres42@gmail.com"
ADMIN_PASS  = "!oivelox2004"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("1. Logging in...")
        page.goto(BASE, wait_until="networkidle")
        if "/login" in page.url or "Entrar" in page.content():
            page.wait_for_selector("input[type='email']")
            page.fill("input[type='email']", ADMIN_EMAIL)
            page.fill("input[type='password']", ADMIN_PASS)
            page.click("button[type='submit']")
            page.wait_for_function("() => !window.location.href.includes('/login')", timeout=20000)
            page.wait_for_load_state("networkidle")
            time.sleep(2)
        print("Logged in!")

        print("2. Opening New Ticket page...")
        page.goto(f"{BASE}/novo-ticket", wait_until="networkidle")
        time.sleep(2)
        
        print("3. Selecting category...")
        # click first category
        btns = page.locator("button").all()
        for b in btns:
            try:
                if "Software" in b.inner_text():
                    b.click()
                    break
            except:
                pass
        
        print("4. Filling title...")
        title_input = page.locator("input[name='title']").first
        title_input.fill("Título com emoji 🚀 e tag <script>")
        
        print("5. Next step...")
        next_btn = page.locator("button").filter(has_text="Próximo").first
        next_btn.click()
        time.sleep(1)
        
        print("6. Filling description...")
        textarea = page.locator("textarea").first
        textarea.fill("Descrição com emoji 🚀 e tag <script>")
        
        next_btn.click()
        time.sleep(1)
        
        print("7. Submitting...")
        submit_btn = page.locator("button").filter(has_text="Abrir Chamado").first
        submit_btn.click()
        
        try:
            print("8. Waiting for success message...")
            page.wait_for_selector("text=criado!", timeout=10000)
            content = page.content()
            if "criado!" in content:
                print("✅ SUCESSO: Chamado com emoji e <> foi criado no servidor!")
            else:
                print("❌ ERRO: Mensagem de sucesso não encontrada.")
        except Exception as e:
            print(f"❌ ERRO ao tentar criar chamado: {e}")
            
        browser.close()

if __name__ == "__main__":
    run_test()
