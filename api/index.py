import sys
import os

# Add the project root to the path so we can import from main
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from main import app
