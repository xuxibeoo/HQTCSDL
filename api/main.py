"""ASGI entry point for `uvicorn api.main:app` from the project root."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from main import app  # noqa: E402
