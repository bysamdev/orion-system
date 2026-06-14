from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.on("console", lambda msg: print(f"CONSOLE {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        page.on("requestfailed", lambda req: print(f"REQ FAILED: {req.url} {req.failure}"))
        
        def handle_response(response):
            if response.status >= 400:
                print(f"RES ERROR: {response.status} {response.url}")
        page.on("response", handle_response)

        print("Navigating to /ticket/1038")
        page.goto("http://127.0.0.1:8080/ticket/1038?testAuth=1&testRole=admin")
        page.wait_for_timeout(3000)
        
        print("Navigating to /ticket/valid-uuid")
        page.goto("http://127.0.0.1:8080/?testAuth=1&testRole=admin")
        page.wait_for_timeout(2000)
        links = page.locator("a[href^='/ticket/']").all()
        if links:
            href = links[0].get_attribute("href")
            print(f"Going to {href}")
            page.goto(f"http://127.0.0.1:8080{href}?testAuth=1&testRole=admin")
            page.wait_for_timeout(3000)
            
        browser.close()

if __name__ == "__main__":
    run_tests()
