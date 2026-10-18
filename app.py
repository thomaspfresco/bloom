"""Vercel / local entrypoint.

Vercel looks for a Flask instance named ``app`` in this file (zero-config).
Locally: ``flask --app app run --debug`` or ``python app.py``.
"""

from bloom import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
