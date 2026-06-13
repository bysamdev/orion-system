import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        print("Navigating to page...")
        page.goto('http://127.0.0.1:8080/?testAuth=true&testRole=admin', timeout=90000, wait_until='domcontentloaded')
        
        # Wait for the sidebar to load
        page.wait_for_selector('nav', timeout=10000)
        page.wait_for_timeout(2000)
        
        artifacts_dir = '/Users/sam/.gemini/antigravity-ide/brain/43deb61c-5341-4916-a497-80f7edd9c37f/scratch/screenshots'
        os.makedirs(artifacts_dir, exist_ok=True)
        
        # Take initial screenshot
        print("Taking initial screenshot (desktop)...")
        page.screenshot(path=f'{artifacts_dir}/desktop_initial.png')
        
        print("Hovering items...")
        items = page.locator('nav button').all()
        for i, item in enumerate(items):
            try:
                # Hover over the item
                item.hover(force=True)
                page.wait_for_timeout(300) # wait for transition
                page.screenshot(path=f'{artifacts_dir}/hover_item_{i}.png')
            except Exception as e:
                print(f"Could not hover item {i}: {e}")
        
        # Change viewport to notebook (1366x768)
        print("Switching to notebook viewport...")
        page.set_viewport_size({'width': 1366, 'height': 768})
        page.wait_for_timeout(500)
        page.screenshot(path=f'{artifacts_dir}/notebook_initial.png')
        
        browser.close()
        print(f"Done capturing screenshots to {artifacts_dir}.")

if __name__ == '__main__':
    run()
