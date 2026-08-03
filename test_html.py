from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800}, ignore_https_errors=True)
        page = context.new_page()
        page.goto("https://orion.bysam.dev/login")
        page.wait_for_load_state('networkidle')
        print(page.content())
        browser.close()

run()
