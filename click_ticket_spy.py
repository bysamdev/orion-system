import sys
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.set_default_timeout(10000)
        page = context.new_page()

        base_url = "http://127.0.0.1:8080"
        
        # log console
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        
        # log requests to supabase tickets
        def handle_request(request):
            if "supabase" in request.url and "tickets" in request.url:
                print(f"NETWORK REQ: {request.url}")
        page.on("request", handle_request)
        
        # log responses to supabase tickets
        def handle_response(response):
            if "supabase" in response.url and "tickets" in response.url:
                print(f"NETWORK RES [{response.status}]: {response.url}")
                try:
                    text = response.text()
                    print(f"RESPONSE BODY: {text[:200]}")
                except:
                    pass
        page.on("response", handle_response)
        
        try:
            print("Navigating to dashboard...")
            page.goto(f"{base_url}/?testAuth=1&testRole=admin", wait_until="networkidle")
            page.wait_for_timeout(3000)
            
            # Find a ticket link and click it
            print("Finding ticket links...")
            links = page.locator("a[href*='/ticket/']")
            count = links.count()
            print(f"Found {count} ticket links")
            
            if count > 0:
                first_link = links.first
                href = first_link.get_attribute("href")
                print(f"Clicking link: {href}")
                first_link.click()
                page.wait_for_timeout(4000)
                print(f"Current URL after click: {page.url}")
        except Exception as e:
            print(f"Exception: {e}")

        browser.close()

if __name__ == "__main__":
    run_tests()
