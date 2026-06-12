from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    base_url = "http://127.0.0.1:8080"

    print("Testing 1. Botão Home aparece isolado no topo do menu sem categoria")
    page.goto(f"{base_url}/?testAuth=1&testRole=admin")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_home_menu.png")
    
    print("Testing 2. Hover no menu: ícone, texto e retângulo mudam de cor juntos")
    # Buscando botão "Início" no nav
    menu_item = page.locator("nav").locator("button").filter(has_text="Início")
    if menu_item.count() > 0:
        # Hovering over the item
        menu_item.first.hover()
        # small wait for CSS transition
        page.wait_for_timeout(300)
        page.screenshot(path="screenshot_menu_hover.png")
        print("Took hover screenshot")
    
    print("Testing 3. Barra lateral aparece em todas as páginas sem sumir")
    page.goto(f"{base_url}/knowledge?testAuth=1&testRole=admin")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_sidebar_knowledge.png")

    page.goto(f"{base_url}/novo-ticket?testAuth=1&testRole=admin")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_sidebar_ticket.png")

    print("Testing 4. Gestor consegue criar artigos, técnico só visualiza")
    # Test as Admin
    page.goto(f"{base_url}/knowledge?testAuth=1&testRole=admin")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_kb_admin.png")
    
    # Test as Tech
    page.goto(f"{base_url}/knowledge?testAuth=1&testRole=technician")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_kb_tech.png")

    print("Testing 5. Página unificada Sistemas+Alertas funciona nas duas abas")
    page.goto(f"{base_url}/sistemas?testAuth=1&testRole=admin")
    page.wait_for_load_state('networkidle')
    page.screenshot(path="screenshot_sistemas_tab_1.png")

    # Click on "Alertas" tab
    tab_alertas = page.locator("button[role='tab']", has_text="Alertas")
    if tab_alertas.count() > 0:
        tab_alertas.first.click()
        page.wait_for_timeout(500)
        page.screenshot(path="screenshot_sistemas_tab_2.png")
        print("Switched to Alertas tab")

    browser.close()
