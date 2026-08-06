#!/usr/bin/env python3
"""
QA SIMPLIFICADO - Orion System
Teste rápido de funcionalidades via HTTP (sem playwright)
Requer: pip install requests
Uso: python qa_simplificado.py
"""

import requests
import re
import sys

BASE = "http://localhost:4175"
TIMEOUT = 10

def log(ok, msg):
    print("✅ OK -" if ok else "❌ ERRO -", msg)

def testar():
    resultados = []
    total = 0
    aprovados = 0
    
    print("\n" + "="*50)
    print("QA COMPLETO - ORION SYSTEM")
    print("="*50 + "\n")
    
    # 1. Health check
    total += 1
    try:
        r = requests.get(BASE, timeout=TIMEOUT)
        ok = r.status_code == 200
        log(ok, f"Health check - Status {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Health check - {e}")
    resultados.append(("Health check", ok if 'ok' in dir() else False))
    
    # 2. Sem auth
    total += 1
    try:
        r = requests.get(f"{BASE}/", allow_redirects=False, timeout=TIMEOUT)
        ok = r.status_code in (302, 301) or "auth" in r.text.lower() or "login" in r.text.lower()
        log(ok, f"Acesso sem auth - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Acesso sem auth - {e}")
        ok = False
    resultados.append(("Acesso sem auth", ok))
    
    # 3. Admin acessa
    total += 1
    try:
        r = requests.get(f"{BASE}/?testAuth=1&testRole=admin", timeout=TIMEOUT)
        ok = r.status_code == 200
        log(ok, f"Admin acessa dashboard - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Admin acessa - {e}")
        ok = False
    resultados.append(("Admin acessa", ok))
    
    # 4. Form novo ticket
    total += 1
    try:
        r = requests.get(f"{BASE}/novo?testAuth=1&testRole=admin", timeout=TIMEOUT)
        ok = r.status_code == 200 and ("titulo" in r.text.lower() or "ticket" in r.text.lower() or "SLA" in r.text)
        log(ok, f"Form novo ticket - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Form novo ticket - {e}")
        ok = False
    resultados.append(("Form novo ticket", ok))
    
    # 5. Admin page
    total += 1
    try:
        r = requests.get(f"{BASE}/admin?testAuth=1&testRole=admin", timeout=TIMEOUT)
        ok = r.status_code == 200
        log(ok, f"Admin page - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Admin page - {e}")
        ok = False
    resultados.append(("Admin page", ok))
    
    # 6. Notificacoes
    total += 1
    try:
        r = requests.get(f"{BASE}/notificacoes?testAuth=1&testRole=admin", timeout=TIMEOUT)
        ok = r.status_code == 200
        log(ok, f"Notificacoes - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Notificacoes - {e}")
        ok = False
    resultados.append(("Notificacoes", ok))
    
    # 7. Knowledge base
    total += 1
    try:
        r = requests.get(f"{BASE}/base-conhecimento?testAuth=1&testRole=admin", allow_redirects=True, timeout=TIMEOUT)
        ok = "knowledge" in r.url.lower() or "conhecimento" in r.text.lower() or r.status_code == 200
        log(ok, f"Knowledge base - {r.url}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Knowledge base - {e}")
        ok = False
    resultados.append(("Knowledge base", ok))
    
    # 8. Relatorios
    total += 1
    try:
        r = requests.get(f"{BASE}/relatorios?testAuth=1&testRole=admin", timeout=TIMEOUT)
        ok = "gráfico" in r.text.lower() or "relatório" in r.text.lower() or r.status_code == 200
        log(ok, f"Relatorios - {r.status_code}")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Relatorios - {e}")
        ok = False
    resultados.append(("Relatorios", ok))
    
    # 9. Secrets expostos
    total += 1
    try:
        r = requests.get(f"{BASE}/?testAuth=1&testRole=admin", timeout=TIMEOUT)
        secrets = re.findall(r'(api_key|secret|SUPABASE_URL|SUPABASE_KEY|anon_key)\s*[:=]["\']?\s*["A-Za-z0-9_-]{20,}', r.text)
        ok = len(secrets) == 0
        log(ok, "Secrets não expostos no HTML")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"Secrets - {e}")
        ok = False
    resultados.append(("Secrets OK", ok))
    
    # 10. autoComplete off
    total += 1
    try:
        r = requests.get(f"{BASE}/?testAuth=1&testRole=admin", timeout=TIMEOUT)
        autocompletes = re.findall(r'<input[^>]*autoComplete\s*=\s*["\']?off', r.text, re.I)
        ok = len(autocompletes) > 0
        log(ok, f"autoComplete='off' - {len(autocompletes)} inputs")
        if ok: aprovados += 1
    except Exception as e:
        log(False, f"AutoComplete - {e}")
        ok = False
    resultados.append(("AutoComplete off", ok))
    
    # RESUMO
    print("\n" + "="*50)
    print(f"RESULTADO GERAL: {aprovados}/{total} testes aprovados")
    pct = (aprovados/total)*100 if total > 0 else 0
    print(f"PORCENTAGEM: {pct:.1f}%")
    print("="*50 + "\n")
    
    # DETALHES
    print("DETALHES:")
    for nome, ok in resultados:
        status = "✅" if ok else "❌"
        print(f"  {status} {nome}")
    
    return aprovados == total

if __name__ == "__main__":
    success = testar()
    sys.exit(0 if success else 1)