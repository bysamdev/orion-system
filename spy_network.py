import sys
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.set_default_timeout(10000)
        page = context.new_page()

        base_url = "http://127.0.0.1:8080"
        
        # intercept and log requests to supabase
        def handle_request(request):
            if "supabase" in request.url and "rest/v1" in request.url:
                print(f"URL: {request.url}")
        
        page.on("request", handle_request)
        
        try:
            test_uuid = "550e8400-e29b-41d4-a716-446655440000"
            page.goto(f"{base_url}/ticket/{test_uuid}?testAuth=1&testRole=admin", wait_until="networkidle")
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Exception: {e}")

        browser.close()

if __name__ == "__main__":
    run_tests()
