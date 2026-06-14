import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    # Regex to find <Input or <input tags
    # that don't already have autoComplete="off"
    # We will just do a string replacement on specific files.

    # 1. TopBar.tsx
    if "TopBar.tsx" in filepath:
        content = content.replace(
            'placeholder="Buscar tickets',
            'autoComplete="off"\n          placeholder="Buscar tickets'
        )

    # 2. Monitoring.tsx
    if "Monitoring.tsx" in filepath:
        content = content.replace(
            'placeholder="Buscar por hostname..."',
            'autoComplete="off"\n                placeholder="Buscar por hostname..."'
        )
        content = content.replace(
            'placeholder="Ex: Matriz - São Paulo"',
            'autoComplete="off"\n                placeholder="Ex: Matriz - São Paulo"'
        )
        content = content.replace(
            'placeholder="Ex: João da Silva',
            'autoComplete="off"\n                placeholder="Ex: João da Silva'
        )

    # 3. Reports.tsx
    if "Reports.tsx" in filepath:
        # All inputs in Reports.tsx should have autoComplete="off"
        content = content.replace('<Input type="date"', '<Input autoComplete="off" type="date"')
        content = content.replace('<Input placeholder="Buscar por cliente, SLA..."', '<Input autoComplete="off" placeholder="Buscar por cliente, SLA..."')

    # 4. TicketFilters.tsx
    if "TicketFilters.tsx" in filepath:
        content = content.replace('placeholder="Buscar tickets..."', 'autoComplete="off" placeholder="Buscar tickets..."')

    # 5. UserManagement.tsx
    if "UserManagement.tsx" in filepath:
        content = content.replace('placeholder="Buscar usuários..."', 'autoComplete="off" placeholder="Buscar usuários..."')

    # 6. CompanyManagement.tsx
    if "CompanyManagement.tsx" in filepath:
        content = content.replace('placeholder="Buscar empresas..."', 'autoComplete="off" placeholder="Buscar empresas..."')

    # 7. Assets.tsx
    if "Assets.tsx" in filepath:
        content = content.replace('placeholder="Buscar ativos..."', 'autoComplete="off" placeholder="Buscar ativos..."')

    # 8. KnowledgeBase.tsx
    if "KnowledgeBase.tsx" in filepath:
        content = content.replace('placeholder="Buscar artigos..."', 'autoComplete="off" placeholder="Buscar artigos..."')

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))
