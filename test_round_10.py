import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Testing Login Email Reset (Repeating 3x)...")
        # Repeating 3 times
        for i in range(3):
            print(f"  Iteration {i+1}...")
            # 1. Login Admin
            await page.goto("http://localhost:5173/login")
            await page.wait_for_selector('input[type="email"]')
            email_val = await page.input_value('input[type="email"]')
            if email_val != "":
                print(f"    ERROR: Email is not empty! Found: {email_val}")
                return
            await page.fill('input[type="email"]', "admin@orionsystem.com")
            await page.fill('input[type="password"]', "test123456")
            await page.click('button[type="submit"]')
            await page.wait_for_selector('text="Sistema Orion"', timeout=5000)
            
            # Logout
            await page.click('button:has(svg.lucide-log-out)')
            await page.wait_for_selector('input[type="email"]')
            email_val = await page.input_value('input[type="email"]')
            if email_val != "":
                print(f"    ERROR: Email is not empty after Admin logout! Found: {email_val}")
                return

            # 2. Login Técnico
            await page.fill('input[type="email"]', "tecnico@orionsystem.com")
            await page.fill('input[type="password"]', "test123456")
            await page.click('button[type="submit"]')
            await page.wait_for_selector('text="Sistema Orion"', timeout=5000)
            
            # Logout
            await page.click('button:has(svg.lucide-log-out)')
            await page.wait_for_selector('input[type="email"]')
            email_val = await page.input_value('input[type="email"]')
            if email_val != "":
                print(f"    ERROR: Email is not empty after Técnico logout! Found: {email_val}")
                return

            # 3. Login Usuário
            await page.fill('input[type="email"]', "samterres42@gmail.com")
            await page.fill('input[type="password"]', "test123456")
            await page.click('button[type="submit"]')
            await page.wait_for_selector('text="Sistema Orion"', timeout=5000)
            
            # Logout
            await page.click('button:has(svg.lucide-log-out)')
            await page.wait_for_selector('input[type="email"]')
            email_val = await page.input_value('input[type="email"]')
            if email_val != "":
                print(f"    ERROR: Email is not empty after User logout! Found: {email_val}")
                return

        print("Login Email Reset validation passed!")

        # 2. Técnico abre modal "Respostas Prontas" no ticket
        print("Testing Respostas Prontas for Técnico...")
        await page.goto("http://localhost:5173/login")
        await page.fill('input[type="email"]', "tecnico@orionsystem.com")
        await page.fill('input[type="password"]', "test123456")
        await page.click('button[type="submit"]')
        await page.wait_for_selector('text="Sistema Orion"', timeout=5000)

        # Go to a ticket (any ticket in Fila de Espera)
        await page.click('a[href="/tickets"]')
        await page.wait_for_selector('text="Tickets"')
        
        # Click on the first ticket
        await page.click('.grid a[href^="/ticket/"]')
        await page.wait_for_selector('text="Interações"')

        # Test shortcut substitution
        print("Testing shortcut substitution in comment field...")
        textarea = page.locator('textarea[placeholder*="Adicionar interação"]')
        await textarea.fill("/remoto")
        await page.wait_for_selector('text="/remoto"')
        await page.wait_for_timeout(500)
        await textarea.press("Tab")
        val = await textarea.input_value()
        if "/remoto" in val and len(val) > 10: # replaced
            print("Shortcut substitution passed!")
        else:
            print(f"Shortcut substitution failed! Value is: {val}")

        # Open Respostas Prontas modal
        print("Testing Respostas Prontas modal...")
        await page.click('button:has-text("Respostas Prontas")')
        await page.wait_for_selector('text="Inserir Resposta Pronta"')
        
        # Check if 5 templates appear
        templates = await page.locator('.space-y-4 > div.p-4').count()
        if templates >= 5:
            print(f"Found {templates} templates! Respostas Prontas validation passed!")
        else:
            print(f"Found {templates} templates instead of 5!")
            
        await browser.close()

asyncio.run(run())
