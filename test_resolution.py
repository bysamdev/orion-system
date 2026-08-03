import time
from playwright.sync_api import sync_playwright

def test_entry_point(page, ticket_id, entry_point_name, resolution_text):
    print(f"Testing {entry_point_name} on ticket {ticket_id}...")
    page.goto(f"http://127.0.0.1:8080/ticket/{ticket_id}")
    page.wait_for_selector("button:has-text('Resolver')", timeout=15000)
    time.sleep(2)
    
    if entry_point_name == "action_bar":
        page.click("button:has-text('Resolver')")
    elif entry_point_name == "dropdown":
        page.click("button:has-text('Em Andamento'), button:has-text('Aberto')")
        time.sleep(1)
        page.click("div[role='menuitem']:has-text('Resolvido')")
    elif entry_point_name == "reply_and_resolve":
        page.fill("textarea", "Esta é uma resposta teste antes de resolver.")
        page.click("button:has-text('Responder e Resolver')")
    elif entry_point_name == "checklist":
        page.click("button:has-text('Resolver')")
        
    page.wait_for_selector("textarea#resolution-notes", timeout=5000)
    time.sleep(1)
    
    # Fill notes
    page.fill("textarea#resolution-notes", resolution_text)
    time.sleep(0.5)
    
    if "checklist" in entry_point_name.lower():
        # find checklist items
        checklist_items = page.locator("div[role='alertdialog'] input[type='checkbox']")
        count = checklist_items.count()
        print(f"  Found {count} checklist items in modal.")
        for i in range(count):
            checklist_items.nth(i).click()
            time.sleep(0.1)
    
    # Confirm
    page.click("button:has-text('Confirmar')")
    time.sleep(3)
    print(f"Finished {entry_point_name}.\n")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Logging in...")
        page.goto("http://127.0.0.1:8080/login")
        page.wait_for_selector("input[type='email']", timeout=15000)
        page.fill("input[type='email']", "tecnico@orionsystem.com")
        page.fill("input[type='password']", "123456")
        page.click("button[type='submit']")
        
        # wait for dashboard
        page.wait_for_selector("text=Dashboard", timeout=15000)
        time.sleep(2)
            
        test_entry_point(page, "acc5b0f0-a2e7-4cf6-92d5-2c1a2ba2abc2", "action_bar", "Resolução via barra de ações - teste com > 20 caracteres")
        test_entry_point(page, "7b8e917c-07ec-4f21-baab-01afe28fb269", "dropdown", "Resolução via dropdown de status - teste com > 20 caracteres")
        test_entry_point(page, "8741c86b-c527-4495-8329-0a8da59e2c9d", "reply_and_resolve", "Resolução via botão responder e resolver - teste com > 20 caracteres")
        test_entry_point(page, "67e647fb-219c-4c28-a02d-edf99d582c80", "checklist", "Resolução de ticket com checklist - testando checkboxes no modal")
        
        browser.close()

if __name__ == "__main__":
    run()
