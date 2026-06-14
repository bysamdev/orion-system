from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Catch console logs
    page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
    
    # Catch network requests to Supabase and API
    def handle_request(request):
        if "supabase" in request.url or "/api/" in request.url:
            print(f">>> REQ: {request.method} {request.url}")
    
    def handle_response(response):
        if "supabase" in response.url or "/api/" in response.url:
            print(f"<<< RES: {response.status} {response.url}")
            
    page.on("request", handle_request)
    page.on("response", handle_response)
    
    print("Navigating to /ticket/1038 ...")
    page.goto('http://localhost:8080/ticket/1038')
    page.wait_for_timeout(3000)
    print("Final URL after 3s:", page.url)
    
    print("Navigating to /ticket/some-valid-uuid ...")
    # let's generate a fake UUID
    page.goto('http://localhost:8080/ticket/550e8400-e29b-41d4-a716-446655440000')
    page.wait_for_timeout(3000)
    print("Final URL after 3s:", page.url)

    browser.close()
