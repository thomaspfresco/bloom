"""HTML pages. Each page is a thin Jinja shell; behaviour lives in public/js."""

from __future__ import annotations

from flask import Blueprint, render_template

pages_bp = Blueprint("pages", __name__)


@pages_bp.get("/")
def compose():
    return render_template("compose.html")


@pages_bp.get("/upload")
def upload():
    return render_template("upload.html")


@pages_bp.get("/about")
def about():
    return render_template("about.html")


@pages_bp.get("/help")
def help_page():
    return render_template("help.html")


@pages_bp.app_errorhandler(404)
def not_found(_error):
    return render_template("404.html"), 404
