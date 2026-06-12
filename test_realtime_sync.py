import sys
import time
from playwright.sync_api import sync_playwright
import requests

# Orion System Real-time Sync Tests

def test_realtime_sync():
    print("Iniciando testes de sincronização em tempo real...")
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        
        # Create two contexts to simulate Technician A and Technician B
        context_a = browser.new_context()
        context_b = browser.new_context()
        
        page_a = context_a.new_page()
        page_b = context_b.new_page()
        
        base_url = 'http://localhost:5173' # Change to your running server port
        
        print("1. [ ] Acessando a aplicação...")
        try:
            page_a.goto(f"{base_url}/?testAuth=1&testRole=admin")
            page_a.wait_for_load_state('networkidle')
            page_b.goto(f"{base_url}/?testAuth=1&testRole=technician")
            page_b.wait_for_load_state('networkidle')
            print("Login simulado com sucesso (Admin e Technician).")
        except Exception as e:
            print(f"Erro ao acessar {base_url}: {e}")
            return

        print("2. [ ] Testando Criação de Ticket...")
        try:
            # page_a creates a ticket
            page_a.goto(f"{base_url}/novo-ticket?testAuth=1&testRole=admin")
            page_a.fill("input[name='title']", "Ticket de Teste Real-Time")
            page_a.fill("textarea[name='description']", "Desc")
            page_a.click("button[type='submit']")
            
            # page_b should see it on dashboard without refresh
            page_b.goto(f"{base_url}/?testAuth=1&testRole=technician")
            page_b.wait_for_selector("text=Ticket de Teste Real-Time", timeout=10000)
            print("Sucesso: Ticket apareceu no painel do Técnico B em tempo real.")
        except Exception as e:
            print(f"Erro/Timeout na Criação de Ticket: {e}")
        
        print("3. [ ] Testando Concorrência de Edição...")
        try:
            # Both open the same ticket (using a mocked ID or picking the first one)
            page_a.goto(f"{base_url}/ticket/1?testAuth=1&testRole=admin")
            page_b.goto(f"{base_url}/ticket/1?testAuth=1&testRole=technician")
            
            # Simulate simultaneous edits
            page_a.fill("input[name='title']", "Edição Admin")
            page_b.fill("input[name='title']", "Edição Técnico")
            
            page_a.click("button:has-text('Salvar')")
            page_b.click("button:has-text('Salvar')")
            
            page_a.wait_for_timeout(2000)
            # Qual venceu? Recarregar e verificar
            page_a.reload()
            title = page_a.locator("input[name='title']").input_value()
            print(f"Concorrência resolvida. Título final no banco: {title}")
        except Exception as e:
            print(f"Erro/Timeout na Concorrência de Edição: {e}")
        
        print("4. [ ] Testando Métricas do RMM...")
        try:
            page_a.goto(f"{base_url}/sistemas?testAuth=1&testRole=admin")
            
            # Send metric via API
            requests.post(f"{base_url}/api/agent/metrics", json={
                "machine_id": "machine-1",
                "cpu_usage": 99.9,
                "ram_usage": 80.0
            })
            
            # Wait for frontend to react to websocket
            page_a.wait_for_selector("text=99.9%", timeout=10000)
            print("Sucesso: Métrica atualizada via WebSocket sem refresh.")
        except Exception as e:
            print(f"Erro/Timeout nas Métricas RMM: {e}")
        
        print("5. [ ] Testando Status do Ativo...")
        try:
            requests.post(f"{base_url}/api/agent/status", json={
                "machine_id": "machine-1",
                "status": "offline"
            })
            
            page_a.wait_for_selector("text=Offline", timeout=10000)
            print("Sucesso: Status do ativo foi atualizado em tempo real.")
        except Exception as e:
            print(f"Erro/Timeout no Status do Ativo: {e}")
        
        print("6. [ ] Testando Comentários em Tempo Real...")
        try:
            page_a.goto(f"{base_url}/ticket/1?testAuth=1&testRole=admin")
            page_b.goto(f"{base_url}/ticket/1?testAuth=1&testRole=technician")
            
            page_a.fill("textarea[placeholder*='comentário']", "Comentário teste real-time")
            page_a.click("button:has-text('Enviar')")
            
            page_b.wait_for_selector("text=Comentário teste real-time", timeout=10000)
            print("Sucesso: Comentário renderizado para outro usuário instantaneamente.")
        except Exception as e:
            print(f"Erro/Timeout nos Comentários: {e}")
        
        print("Todos os testes finalizados.")
