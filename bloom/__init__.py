"""BLOOM Flask application package."""

from __future__ import annotations

from flask import Flask

from .config import Config
from .routes import register_blueprints


def create_app(config: type[Config] = Config) -> Flask:
    """Application factory.

    ``public/`` is served by Vercel's CDN in production. Locally we mount it at
    the site root so URLs are identical in both environments.
    """
    app = Flask(
        __name__,
        static_folder=str(config.PUBLIC_DIR),
        static_url_path="",
        template_folder=str(config.TEMPLATE_DIR),
    )
    app.config.from_object(config)
    register_blueprints(app)

    @app.context_processor
    def inject_asset_version():
        return {"asset_version": config.ASSET_VERSION}

    return app
