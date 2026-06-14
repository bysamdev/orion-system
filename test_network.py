import os
import json
import time
from urllib.parse import urlparse
from collections import defaultdict
from playwright.sync_api import sync_playwright

def main():
    print("Starting Playwright script...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_har_path="/Users/sam/.gemini/antigravity-ide/brain/43deb61c-5341-4916-a497-80f7edd9c37f/network.har")
        page = context.new_page()

        requests_data = {}
        duplicates = defaultdict(int)
        ws_connections = 0

        def on_request(request):
            url = request.url
            if 'supabase' in url or 'rest/v1' in url or 'graphql' in url:
                requests_data[request] = {
                    'url': url,
                    'method': request.method,
                    'start_time': time.time(),
                }

        def on_response(response):
            req = response.request
            if req in requests_data:
                data = requests_data[req]
                data['end_time'] = time.time()
                data['duration_ms'] = (data['end_time'] - data['start_time']) * 1000
                data['status'] = response.status
                
                # Check for PGRST headers or body
                data['is_error'] = response.status >= 400
                
                # Count duplicates (GET requests only for idempotency check)
                if req.method == 'GET':
                    duplicates[req.url] += 1

        def on_websocket(web_socket):
            nonlocal ws_connections
            if 'realtime' in web_socket.url:
                ws_connections += 1

        page.on("request", on_request)
        page.on("response", on_response)
        page.on("websocket", on_websocket)

        # Try to navigate to the app
        urls_to_try = [
            "http://127.0.0.1:8080",
            "http://localhost:8080",
            "http://orion.bysam.dev",
            "http://orion.bysam.dev:8080"
        ]
        
        success = False
        for url in urls_to_try:
            try:
                print(f"Trying to navigate to {url}...")
                page.goto(url, timeout=10000)
                page.wait_for_load_state('networkidle', timeout=10000)
                success = True
                print(f"Successfully loaded {url}")
                break
            except Exception as e:
                print(f"Failed to load {url}: {e}")

        if not success:
            print("Could not load any URL. Exiting.")
            browser.close()
            return

        # Take a screenshot
        screenshot_path = "/Users/sam/.gemini/antigravity-ide/brain/43deb61c-5341-4916-a497-80f7edd9c37f/app_screenshot.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Wait a bit for background requests
        page.wait_for_timeout(5000)

        browser.close()

        print("\n--- NETWORK ANALYSIS REPORT ---")
        
        slow_reqs = [d for d in requests_data.values() if d.get('duration_ms', 0) > 500]
        print(f"\n1. Requests taking > 500ms: {len(slow_reqs)}")
        for req in slow_reqs:
            print(f"  [{req['method']}] {req['url']} - {req['duration_ms']:.0f}ms")

        error_reqs = [d for d in requests_data.values() if d.get('is_error')]
        print(f"\n2. Error Requests (400, 500, PGRST): {len(error_reqs)}")
        for req in error_reqs:
            print(f"  [{req['method']}] {req['url']} - Status {req['status']}")

        dups = {k: v for k, v in duplicates.items() if v > 1}
        print(f"\n3. Duplicate Queries (same GET URL): {len(dups)}")
        for url, count in dups.items():
            print(f"  {url} - {count} times")

        print(f"\n4. Duplicate WebSocket connections: {ws_connections}")
        if ws_connections > 1:
            print("  WARNING: Multiple Realtime WebSocket connections detected!")
        elif ws_connections == 1:
            print("  OK: Only 1 WebSocket connection.")
        else:
            print("  No WebSocket connections detected.")

        print("\n--- END OF REPORT ---")

if __name__ == "__main__":
    main()
