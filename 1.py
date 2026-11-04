
import os

EXTENSIONS = ('.html', '.css', '.js', '.ts', '.tsx', 'yml', 'md', 'csv', 'sh', 'mjs', 'Dockerfile', 'Caddyfile','yaml')
OUTPUT_FILE = 'proyecto_txt'
IGNORE_DIRS = {'.git', 'node_modules', 'dist', 'build','venv','.venv'}

with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            if file.endswith(EXTENSIONS):
                path = os.path.join(root, file)
                outfile.write(f'=== ARCHIVO: {path} ===\n')
                try:
                    with open(path, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read() + '\n\n')
                except Exception as e:
                    outfile.write(f'[Error al leer el archivo: {e}]\n\n')

print(f'Proyecto empaquetado en {OUTPUT_FILE}')
