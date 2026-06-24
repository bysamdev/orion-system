from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/login")
        
        # Login
        page.fill('input[type="email"]', 'tecnico@orionsystem.com')
        page.fill('input[type="password"]', '123456')
        page.click('button[type="submit"]')
        
        page.wait_for_selector('text=Fila de Espera')
        
        # Click a ticket row
        # (Assuming there's a ticket in the table)
        page.click('tbody tr:first-child')
        
        # Click Responder
        page.wait_for_selector('text=Responder')
        page.click('text=Responder')
        
        # Intercept network to see canned_responses query
        responses = []
        page.on("response", lambda response: responses.append(response) if "canned_responses" in response.url else None)
        
        # Click Respostas Prontas
        page.wait_for_selector('text=Respostas Prontas')
        page.click('text=Respostas Prontas')
        
        # Wait a bit
        time.sleep(2)
        
        # Check text
        try:
            content = page.content()
            if 'Nenhuma resposta pronta cadastrada' in content:
                print("FOUND empty message!")
            elif 'Aguardando retorno do cliente' in content:
                print("FOUND responses!")
            else:
                print("SOMETHING ELSE")
        except Exception as e:
            print("Error", e)
            
        for r in responses:
            print("URL:", r.url)
            print("Status:", r.status)
            try:
                print("Body:", r.json())
            except:
                pass
                
        browser.close()

if __name__ == '__main__':
    run()
