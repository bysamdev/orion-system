from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:8080/auth')
    # wait for page
    page.wait_for_load_state('networkidle')
    print("Auth page loaded. Current URL:", page.url)

    # Instead of logging in through UI, maybe I can just see what happens if I navigate directly.
    # Actually, the user says "Nenhum ticket abre". Let's capture the network requests.
    page.on("request", lambda request: print(">>", request.method, request.url))
    page.on("response", lambda response: print("<<", response.status, response.url))
    
    # Let's try to bypass auth or login
    # Need to know the credentials or just see if the error happens anyway
    browser.close()
