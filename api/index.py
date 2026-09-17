import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_path))

from main import app