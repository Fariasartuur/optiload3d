import sys
import os

# Adiciona o diretório backend ao path do Python
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Importa a instância 'app' do FastAPI do seu main.py
from main import app