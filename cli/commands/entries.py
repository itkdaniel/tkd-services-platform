import json

import click
from rich.console import Console
from rich.table import Table

import logging_utils as log
from api_client import ApiClient, ApiError

_console = Console()


@click.group(name="entries", help="Manage data entries (graph nodes) inside a feature database.")
def entries_group() -> None:
    pass


@entries_group.command(name="add", help="Add a data entry to a table. --data is a JSON object matching the table's fields.")
@click.argument("table_id", type=int)
@click.option("--label", required=True, help="Human-readable label for this entry (graph node label).")
@click.option("--data", "data_json", required=True, help='JSON object, e.g. \'{"player": "Jayson Tatum", "propLine": 27.5}\'')
def add(table_id: int, label: str, data_json: str) -> None:
    try:
        data = json.loads(data_json)
    except json.JSONDecodeError as exc:
        log.error(f"--data must be valid JSON: {exc}")
        raise SystemExit(1)

    client = ApiClient()
    try:
        entry = client.post(f"/tables/{table_id}/entries", {"label": label, "data": data})
    except ApiError as exc:
        log.error(f"Failed to add entry: {exc.message}")
        raise SystemExit(1)
    log.success(f"Added entry '{entry['label']}' (id {entry['id']}) to table {table_id}.")


@entries_group.command(name="list", help="List entries in a table.")
@click.argument("table_id", type=int)
def list_entries(table_id: int) -> None:
    client = ApiClient()
    try:
        rows = client.get(f"/tables/{table_id}/entries")
    except ApiError as exc:
        log.error(f"Failed to list entries: {exc.message}")
        raise SystemExit(1)
    if not rows:
        log.info(f"Table {table_id} has no entries yet.")
        return
    table = Table(title=f"Entries in table {table_id}")
    table.add_column("ID", justify="right")
    table.add_column("Label")
    table.add_column("Data")
    for row in rows:
        table.add_row(str(row["id"]), row["label"], json.dumps(row["data"]))
    _console.print(table)


@entries_group.command(name="get", help="Show one entry's full detail: fields, table, and relations.")
@click.argument("entry_id", type=int)
def get_entry(entry_id: int) -> None:
    client = ApiClient()
    try:
        detail = client.get(f"/entries/{entry_id}")
    except ApiError as exc:
        log.error(f"Failed to fetch entry: {exc.message}")
        raise SystemExit(1)
    _console.print(detail)


@entries_group.command(name="delete", help="Delete an entry and its relations.")
@click.argument("entry_id", type=int)
@click.confirmation_option(prompt="This deletes the entry and its relations. Continue?")
def delete_entry(entry_id: int) -> None:
    client = ApiClient()
    try:
        client.delete(f"/entries/{entry_id}")
    except ApiError as exc:
        log.error(f"Failed to delete entry: {exc.message}")
        raise SystemExit(1)
    log.success(f"Deleted entry {entry_id}.")
