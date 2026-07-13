"""
Thin HTTP client for the Feature Graph API. The CLI never touches Postgres
directly — the OpenAPI contract (lib/api-spec/openapi.yaml) is the single
source of truth shared with the web frontend, so the CLI talks to the same
endpoints over HTTP and stays in sync with the same contract automatically.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

import logging_utils as log

_SESSION_FILE = Path.home() / ".feature_graph_cli" / "session.json"


def _default_base_url() -> str:
    explicit = os.environ.get("FEATURE_GRAPH_API_URL")
    if explicit:
        return explicit.rstrip("/")
    dev_domain = os.environ.get("REPLIT_DEV_DOMAIN")
    if dev_domain:
        return f"https://{dev_domain}/api"
    return "http://localhost:8080/api"


class ApiError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class ApiClient:
    """Session-cookie-authenticated client. Cookies persist to disk between
    CLI invocations so `feature-graph login` survives across commands."""

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or _default_base_url()
        self.session = requests.Session()
        self._load_cookies()

    def _load_cookies(self) -> None:
        if _SESSION_FILE.exists():
            try:
                data = json.loads(_SESSION_FILE.read_text())
                self.session.cookies.update(data.get("cookies", {}))
            except (json.JSONDecodeError, OSError) as exc:
                log.debug(f"Could not read saved session ({exc}); starting fresh.")

    def _save_cookies(self) -> None:
        _SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        cookies = self.session.cookies.get_dict()
        _SESSION_FILE.write_text(json.dumps({"cookies": cookies}))

    def clear_session(self) -> None:
        self.session.cookies.clear()
        if _SESSION_FILE.exists():
            _SESSION_FILE.unlink()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self.base_url}{path}"
        log.debug(f"{method} {url} {kwargs.get('json') or kwargs.get('params') or ''}")
        try:
            resp = self.session.request(method, url, timeout=15, **kwargs)
        except requests.exceptions.ConnectionError as exc:
            raise ApiError(0, f"Could not reach the API server at {self.base_url} ({exc})") from exc

        self._save_cookies()

        if not resp.ok:
            try:
                body = resp.json()
                message = body.get("error", resp.text)
            except ValueError:
                message = resp.text
            raise ApiError(resp.status_code, message)

        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params)

    def post(self, path: str, data: dict[str, Any] | None = None) -> Any:
        return self._request("POST", path, json=data or {})

    def delete(self, path: str) -> Any:
        return self._request("DELETE", path)
