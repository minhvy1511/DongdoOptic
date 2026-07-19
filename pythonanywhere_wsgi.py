import sys

project_home = "/home/getvisionid/DongDo_Optic/backend"
if project_home not in sys.path:
    sys.path.insert(0, project_home)

from a2wsgi import ASGIMiddleware
from app.main import app as asgi_app

application = ASGIMiddleware(asgi_app)
