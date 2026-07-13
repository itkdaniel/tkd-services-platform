import click
from rich.console import Console
from rich.table import Table

import logging_utils as log
from api_client import ApiClient, ApiError

_console = Console()


@click.group(name="relations", help="Draw and inspect directed, weighted, justified edges between entries.")
def relations_group() -> None:
    pass


@relations_group.command(name="add", help="Create a directed relation (edge) between two entries.")
@click.option("--from", "from_entry_id", required=True, type=int)
@click.option("--to", "to_entry_id", required=True, type=int)
@click.option("--type", "relation_type", required=True, help="Free-text relation type, e.g. 'correlated-teammate-props'.")
@click.option("--weight", type=click.FloatRange(0, 1), default=None, help="Optional probability/confidence (0-1).")
@click.option("--justification", default=None, help="Optional free-text reason for this relation.")
def add(from_entry_id: int, to_entry_id: int, relation_type: str, weight: float | None, justification: str | None) -> None:
    client = ApiClient()
    try:
        relation = client.post(
            "/relations",
            {
                "fromEntryId": from_entry_id,
                "toEntryId": to_entry_id,
                "relationType": relation_type,
                "weight": weight,
                "justification": justification,
            },
        )
    except ApiError as exc:
        log.error(f"Failed to create relation: {exc.message}")
        raise SystemExit(1)
    log.success(f"Created relation {relation['id']}: {from_entry_id} -[{relation_type}]-> {to_entry_id}.")


@relations_group.command(name="list", help="List every relation in the graph.")
def list_relations() -> None:
    client = ApiClient()
    try:
        rows = client.get("/relations")
    except ApiError as exc:
        log.error(f"Failed to list relations: {exc.message}")
        raise SystemExit(1)
    if not rows:
        log.info("No relations yet.")
        return
    table = Table(title="Relations")
    table.add_column("ID", justify="right")
    table.add_column("From", justify="right")
    table.add_column("Type")
    table.add_column("To", justify="right")
    table.add_column("Weight")
    table.add_column("Justification")
    for row in rows:
        weight = f"{row['weight']:.2f}" if row.get("weight") is not None else "-"
        table.add_row(
            str(row["id"]), str(row["fromEntryId"]), row["relationType"], str(row["toEntryId"]),
            weight, row.get("justification") or "-",
        )
    _console.print(table)
