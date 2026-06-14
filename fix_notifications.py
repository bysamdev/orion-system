import re

with open("src/pages/Notifications.tsx", "r") as f:
    content = f.read()

# Replace hardcoded dark-mode classes with theme variables
content = content.replace("text-white", "text-foreground")
content = content.replace("border-white/5 bg-white/5 backdrop-blur-md", "border-border/40 bg-card/50 backdrop-blur-md")
content = content.replace("bg-purple-500/10", "bg-primary/10")
content = content.replace("text-purple-400", "text-primary")
content = content.replace("text-gray-400", "text-muted-foreground")

with open("src/pages/Notifications.tsx", "w") as f:
    f.write(content)
