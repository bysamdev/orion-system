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

        print("2. Opening Tickets list...")
        page.goto(f"{BASE}/historico", wait_until="networkidle")
        time.sleep(2)
        
        print("3. Clicking first ticket...")
        # click first ticket in the table
        first_ticket = page.locator("tbody tr").first
        first_ticket.click()
        time.sleep(2)
        
        print("4. Filling comment...")
        textarea = page.locator("textarea").first
        textarea.fill("Comentário de teste com tags <script> e emojis 🐛🔥")
        
        print("5. Submitting comment...")
        submit_btn = page.locator("button").filter(has_text="Adicionar").first
        submit_btn.click()
        
        try:
            print("6. Waiting for success message...")
            page.wait_for_selector("text=adicionado com sucesso", timeout=10000)
            print("✅ SUCESSO: Comentário com emoji e <> foi criado no servidor!")
        except Exception as e:
            print(f"❌ ERRO ao tentar criar comentário: {e}")
            
        browser.close()

if __name__ == "__main__":
    run_test()
