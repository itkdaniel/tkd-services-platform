import click

import logging_utils as log
from api_client import ApiClient, ApiError


@click.group(name="auth", help="Register, log in, log out, and check who you are.")
def auth_group() -> None:
    pass


@auth_group.command(name="register", help="Create a new account. The first account ever created becomes an admin.")
@click.option("--username", prompt=True)
@click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
def register(username: str, password: str) -> None:
    client = ApiClient()
    try:
        user = client.post("/auth/register", {"username": username, "password": password})
    except ApiError as exc:
        log.error(f"Registration failed: {exc.message}")
        raise SystemExit(1)
    log.success(f"Registered and signed in as '{user['username']}' (role: {user['role']}).")


@auth_group.command(name="login", help="Log in to an existing account.")
@click.option("--username", prompt=True)
@click.option("--password", prompt=True, hide_input=True)
def login(username: str, password: str) -> None:
    client = ApiClient()
    try:
        user = client.post("/auth/login", {"username": username, "password": password})
    except ApiError as exc:
        log.error(f"Login failed: {exc.message}")
        raise SystemExit(1)
    log.success(f"Signed in as '{user['username']}' (role: {user['role']}).")


@auth_group.command(name="logout", help="Log out and forget the saved session.")
def logout() -> None:
    client = ApiClient()
    try:
        client.post("/auth/logout")
    except ApiError as exc:
        log.warning(f"Server logout request failed ({exc.message}); clearing local session anyway.")
    client.clear_session()
    log.success("Signed out.")


@auth_group.command(name="whoami", help="Show the currently signed-in user, or Guest.")
def whoami() -> None:
    client = ApiClient()
    try:
        session = client.get("/auth/me")
    except ApiError as exc:
        log.error(f"Could not reach the API: {exc.message}")
        raise SystemExit(1)
    user = session.get("user")
    if user:
        log.info(f"Signed in as '{user['username']}' (role: {user['role']}).")
    else:
        log.info("Not signed in (Guest — read-only access).")
