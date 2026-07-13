import click
from rich.console import Console
from rich.table import Table

import logging_utils as log
from api_client import ApiClient, ApiError

_console = Console()


@click.group(name="fields", help="Manage a feature database's typed field schema.")
def fields_group() -> None:
    pass


@fields_group.command(name="add", help="Add a new field to a table's schema.")
@click.argument("table_id", type=int)
@click.option("--name", required=True)
@click.option("--type", "data_type", required=True, type=click.Choice(["string", "number", "boolean", "date", "json"]))
@click.option("--description", default=None)
@click.option("--required", is_flag=True, default=False)
def add(table_id: int, name: str, data_type: str, description: str | None, required: bool) -> None:
    client = ApiClient()
    try:
        field = client.post(
            f"/tables/{table_id}/fields",
            {"name": name, "dataType": data_type, "description": description, "required": required},
        )
    except ApiError as exc:
        log.error(f"Failed to add field: {exc.message}")
        raise SystemExit(1)
    log.success(f"Added field '{field['name']}' ({field['dataType']}) to table {table_id}.")


@fields_group.command(name="list", help="List a table's field schema.")
@click.argument("table_id", type=int)
def list_fields(table_id: int) -> None:
    client = ApiClient()
    try:
        rows = client.get(f"/tables/{table_id}/fields")
    except ApiError as exc:
        log.error(f"Failed to list fields: {exc.message}")
        raise SystemExit(1)
    if not rows:
        log.info(f"Table {table_id} has no fields yet.")
        return
    table = Table(title=f"Fields for table {table_id}")
    table.add_column("Name")
    table.add_column("Type")
    table.add_column("Required")
    table.add_column("Description")
    for row in rows:
        table.add_row(row["name"], row["dataType"], "yes" if row["required"] else "no", row.get("description") or "-")
    _console.print(table)
