import sys
import os

# Adiciona o diretório 'backend' ao path para importar 'main.py'
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app

# Handler exportado para a Vercel
app = app