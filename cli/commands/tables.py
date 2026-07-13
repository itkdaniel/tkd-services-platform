import click
from rich.console import Console
from rich.table import Table

import logging_utils as log
from api_client import ApiClient, ApiError

_console = Console()


@click.group(name="tables", help="Create and manage feature databases (tables).")
def tables_group() -> None:
    pass


@tables_group.command(name="create", help="Create a new feature database.")
@click.option("--name", required=True, help="Human-readable table name, e.g. 'NBA Player Props'.")
@click.option("--category", required=True, help="Category used for graph clustering/coloring, e.g. 'sports-betting'.")
@click.option("--description", default=None)
def create(name: str, category: str, description: str | None) -> None:
    client = ApiClient()
    try:
        table = client.post("/tables", {"name": name, "category": category, "description": description})
    except ApiError as exc:
        log.error(f"Failed to create table: {exc.message}")
        raise SystemExit(1)
    log.success(f"Created table '{table['name']}' (id {table['id']}, slug '{table['slug']}').")


@tables_group.command(name="list", help="List all feature databases.")
def list_tables() -> None:
    client = ApiClient()
    try:
        rows = client.get("/tables")
    except ApiError as exc:
        log.error(f"Failed to list tables: {exc.message}")
        raise SystemExit(1)
    if not rows:
        log.info("No tables yet. Create one with: feature-graph tables create --name ... --category ...")
        return
    table = Table(title="Feature Databases")
    table.add_column("ID", justify="right")
    table.add_column("Name")
    table.add_column("Slug")
    table.add_column("Category")
    table.add_column("Created By")
    for row in rows:
        table.add_row(str(row["id"]), row["name"], row["slug"], row["category"], row["createdBy"] or "-")
    _console.print(table)


@tables_group.command(name="get", help="Show one feature database by id.")
@click.argument("table_id", type=int)
def get_table(table_id: int) -> None:
    client = ApiClient()
    try:
        row = client.get(f"/tables/{table_id}")
    except ApiError as exc:
        log.error(f"Failed to fetch table: {exc.message}")
        raise SystemExit(1)
    _console.print(row)


@tables_group.command(name="delete", help="Delete a feature database and everything in it. Admin only.")
@click.argument("table_id", type=int)
@click.confirmation_option(prompt="This deletes the table and all its fields/entries/relations. Continue?")
def delete_table(table_id: int) -> None:
    client = ApiClient()
    try:
        client.delete(f"/tables/{table_id}")
    except ApiError as exc:
        log.error(f"Failed to delete table: {exc.message}")
        raise SystemExit(1)
    log.success(f"Deleted table {table_id}.")
