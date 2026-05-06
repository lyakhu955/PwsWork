import sys

with open('js/schedule.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "window.open" in line and "att.url" in line:
        if "attachment-thumbnail" in line:
            lines[i] = '                html += \'<img src="\' + att.url + \'" class="attachment-thumbnail" onclick="window.open(\\\'\' + att.url + \'\\\', \\\'_blank\\\')" title="Apri immagine" alt="Allegato">\';\n'
        elif "Apri PDF" in line:
            lines[i] = '                html += \'<div class="attachment-file-icon" onclick="window.open(\\\'\' + att.url + \'\\\', \\\'_blank\\\')" title="Apri PDF">\';\n'
        elif "attachment-file-icon" in line:
            lines[i] = '                html += \'<div class="attachment-file-icon" onclick="window.open(\\\'\' + att.url + \'\\\', \\\'_blank\\\')">\';\n'

with open('js/schedule.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
