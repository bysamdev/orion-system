import os
import re

src_dir = '/Users/sam/Documents/orion-system/src'
all_files = []

for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx'):
            all_files.append(os.path.join(root, f))

# Find all import statements in all files
imported_paths = set()
import_patterns = [
    re.compile(r'from\s+[\'"]([^\'"]+)[\'"]'),
    re.compile(r'import\s+[\'"]([^\'"]+)[\'"]'),
    re.compile(r'import\(\s*[\'"]([^\'"]+)[\'"]\s*\)')
]

for file_path in all_files:
    try:
        with open(file_path, 'r', errors='ignore') as f:
            content = f.read()
            for pattern in import_patterns:
                for match in pattern.finditer(content):
                    imp = match.group(1)
                    if imp.startswith('.') or imp.startswith('@/'):
                        imported_paths.add(imp)
    except Exception as e:
        pass

# Resolve imports to actual file paths
def resolve_import(imp, current_file):
    if imp.startswith('@/'):
        res = os.path.join(src_dir, imp[2:])
    else:
        res = os.path.join(os.path.dirname(current_file), imp)
    
    # Check extensions
    for ext in ['.ts', '.tsx', '/index.ts', '/index.tsx']:
        if os.path.exists(res + ext):
            return os.path.abspath(res + ext)
        if ext.startswith('/') and os.path.exists(res + ext.replace('/', '')):
            return os.path.abspath(res + ext.replace('/', ''))
    return None

resolved_imports = set()
for file_path in all_files:
    try:
        with open(file_path, 'r', errors='ignore') as f:
            content = f.read()
            for pattern in import_patterns:
                for match in pattern.finditer(content):
                    imp = match.group(1)
                    if imp.startswith('.') or imp.startswith('@/'):
                        resolved = resolve_import(imp, file_path)
                        if resolved:
                            resolved_imports.add(resolved)
    except Exception as e:
        pass

# Also include main entry points
entry_points = [
    os.path.abspath(os.path.join(src_dir, 'main.tsx')),
    os.path.abspath(os.path.join(src_dir, 'App.tsx')),
    os.path.abspath(os.path.join(src_dir, 'vite-env.d.ts')),
]
for ep in entry_points:
    resolved_imports.add(ep)

# Find unreferenced files
unreferenced = []
for file_path in all_files:
    abs_path = os.path.abspath(file_path)
    if abs_path not in resolved_imports:
        # Check if it is a UI component (often imported dynamically or not)
        unreferenced.append(file_path)

print("Unreferenced files:")
for f in sorted(unreferenced):
    # Exclude UI components from shadcn as they are often kept even if unused
    if 'components/ui/' not in f:
        print(f)
