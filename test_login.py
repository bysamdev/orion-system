from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        page.goto('http://localhost:4175/')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/Users/sam/.gemini/antigravity-ide/brain/5d5e1aae-325d-4c36-a740-32668d48e111/scratch/test_login_page.png')
        print("URL is", page.url)

run()
