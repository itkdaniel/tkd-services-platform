/**
 * Seeds a small worked example so the graph isn't empty on first load:
 * an NBA player-prop table with a few picks and a correlation chain between
 * them. Safe to re-run — it's a no-op if the example table already exists.
 *
 * Usage: pnpm --filter @workspace/api-server run seed
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, entityRelationsTable, featureEntriesTable, featureFieldsTable, featureTablesTable, usersTable, projectsTable } from "@workspace/db";

async function main() {
  const [demoUser] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.username, "demo"));

  let seedUserId: number;
  let seedUsername: string;
  if (!demoUser) {
    const passwordHash = await bcrypt.hash("demo12345", 12);
    const [user] = await db
      .insert(usersTable)
      .values({ username: "demo", passwordHash, role: "admin" })
      .returning();
    if (!user) throw new Error("Failed to seed demo user");
    seedUserId = user.id;
    seedUsername = user.username;
    console.log(`Created seed account "demo" / "demo12345" (role: admin).`);
  } else {
    seedUserId = demoUser.id;
    seedUsername = demoUser.username;
  }

  const [existingProject] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.slug, "feature-graph-explorer"));
  if (!existingProject) {
    await db.insert(projectsTable).values({
      slug: "feature-graph-explorer",
      name: "Feature Graph Explorer",
      description:
        "An interactive knowledge graph over factory-managed feature databases — browse entries and the correlation chains between them.",
      githubUrl: "https://github.com/replit/feature-graph",
      demoUrl: "/",
      demoType: "external",
      ownerId: seedUserId,
      ownerUsername: seedUsername,
    });
    console.log('Seeded example portfolio project "Feature Graph Explorer".');
  }

  const [existing] = await db
    .select({ id: featureTablesTable.id })
    .from(featureTablesTable)
    .where(eq(featureTablesTable.slug, "nba-player-props"));

  if (existing) {
    console.log("Seed data already present (table 'nba-player-props' exists) — skipping.");
    await closeAndExit();
    return;
  }

  const [table] = await db
    .insert(featureTablesTable)
    .values({
      name: "NBA Player Props",
      slug: "nba-player-props",
      category: "sports-betting",
      description: "Player prop picks with predicted outcome, probability, and correlation chains.",
      createdBy: seedUsername,
    })
    .returning();
  if (!table) throw new Error("Failed to seed feature table");

  await db.insert(featureFieldsTable).values([
    { tableId: table.id, name: "player", dataType: "string", required: true },
    { tableId: table.id, name: "matchup", dataType: "string", required: true },
    { tableId: table.id, name: "propLine", dataType: "number", required: true },
    { tableId: table.id, name: "pick", dataType: "string", description: "Over or Under", required: true },
    { tableId: table.id, name: "probability", dataType: "number", description: "Model-estimated hit probability (0-1)", required: false },
  ]);

  const [tatum, brown, holiday] = await db
    .insert(featureEntriesTable)
    .values([
      {
        tableId: table.id,
        label: "Jayson Tatum Over 27.5 PTS",
        data: { player: "Jayson Tatum", matchup: "BOS vs NYK", propLine: 27.5, pick: "Over", probability: 0.62 },
      },
      {
        tableId: table.id,
        label: "Jaylen Brown Over 24.5 PTS",
        data: { player: "Jaylen Brown", matchup: "BOS vs NYK", propLine: 24.5, pick: "Over", probability: 0.58 },
      },
      {
        tableId: table.id,
        label: "Jrue Holiday Over 4.5 AST",
        data: { player: "Jrue Holiday", matchup: "BOS vs NYK", propLine: 4.5, pick: "Over", probability: 0.55 },
      },
    ])
    .returning();
  if (!tatum || !brown || !holiday) throw new Error("Failed to seed feature entries");

  await db.insert(entityRelationsTable).values([
    {
      fromEntryId: tatum.id,
      toEntryId: brown.id,
      relationType: "correlated-teammate-props",
      weight: 0.71,
      justification: "Both scoring props tend to hit together when Boston's offense plays fast and shares the floor.",
    },
    {
      fromEntryId: holiday.id,
      toEntryId: tatum.id,
      relationType: "sets-up",
      weight: 0.64,
      justification: "Holiday assists frequently set up Tatum's high-value shot attempts.",
    },
  ]);

  console.log(`Seeded table "${table.name}" (id ${table.id}) with 3 entries and 2 relations.`);
  await closeAndExit();
}

async function closeAndExit() {
  const { pool } = await import("@workspace/db");
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  const { pool } = await import("@workspace/db");
  await pool.end();
  process.exit(1);
});
