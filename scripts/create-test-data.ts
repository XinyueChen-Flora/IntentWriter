/**
 * Test data creation script for drift detection testing
 *
 * Run with: npx ts-node scripts/create-test-data.ts <room-id>
 *
 * Creates:
 * - A root intent with 3 child intents
 * - Writing content that:
 *   1. Covers intent 1 fully
 *   2. Partially covers intent 2
 *   3. Misses intent 3 completely
 *   4. Has orphan content not in any intent
 */

import WebSocket from "ws";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

async function createTestData(roomId: string) {
  console.log(`Creating test data for room: ${roomId}`);
  console.log(`Connecting to PartyKit at: ${PARTYKIT_HOST}`);

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://${PARTYKIT_HOST}/party/main/${roomId}`);

    ws.on("open", () => {
      console.log("Connected to PartyKit");

      // Create root intent
      const rootIntentId = generateId();
      const child1Id = generateId();
      const child2Id = generateId();
      const child3Id = generateId();
      const writingBlockId = generateId();

      const now = Date.now();

      // Root intent block
      const rootIntent = {
        id: rootIntentId,
        content: "Write a compelling introduction about the benefits of remote work",
        position: 0,
        linkedWritingIds: [writingBlockId],
        createdAt: now,
        updatedAt: now,
        parentId: null,
        level: 0,
        intentTag: "section",
      };

      // Child intent 1 - will be COVERED
      const childIntent1 = {
        id: child1Id,
        content: "Explain flexibility and work-life balance advantages",
        position: 0,
        linkedWritingIds: [],
        createdAt: now,
        updatedAt: now,
        parentId: rootIntentId,
        level: 1,
      };

      // Child intent 2 - will be PARTIAL
      const childIntent2 = {
        id: child2Id,
        content: "Discuss cost savings for both employees and employers",
        position: 1,
        linkedWritingIds: [],
        createdAt: now,
        updatedAt: now,
        parentId: rootIntentId,
        level: 1,
      };

      // Child intent 3 - will be MISSING
      const childIntent3 = {
        id: child3Id,
        content: "Address environmental benefits and reduced carbon footprint",
        position: 2,
        linkedWritingIds: [],
        createdAt: now,
        updatedAt: now,
        parentId: rootIntentId,
        level: 1,
      };

      // Writing block linked to root intent
      const writingBlock = {
        id: writingBlockId,
        content: "",
        position: 0,
        linkedIntentId: rootIntentId,
        createdAt: now,
        updatedAt: now,
      };

      // Send all the blocks
      console.log("Creating intent blocks...");

      ws.send(JSON.stringify({ type: "add_intent_block", block: rootIntent }));
      ws.send(JSON.stringify({ type: "add_intent_block", block: childIntent1 }));
      ws.send(JSON.stringify({ type: "add_intent_block", block: childIntent2 }));
      ws.send(JSON.stringify({ type: "add_intent_block", block: childIntent3 }));
      ws.send(JSON.stringify({ type: "add_writing_block", block: writingBlock }));

      // Update room meta to writing phase
      ws.send(JSON.stringify({
        type: "update_room_meta",
        updates: {
          phase: "writing",
          baselineVersion: 1,
          phaseTransitionAt: now,
        }
      }));

      console.log("\nTest data created successfully!");
      console.log("\n=== Intent Structure ===");
      console.log(`Root: "${rootIntent.content}" [${rootIntentId}]`);
      console.log(`  ├─ Child 1 (should be COVERED): "${childIntent1.content}" [${child1Id}]`);
      console.log(`  ├─ Child 2 (should be PARTIAL): "${childIntent2.content}" [${child2Id}]`);
      console.log(`  └─ Child 3 (should be MISSING): "${childIntent3.content}" [${child3Id}]`);
      console.log(`\nWriting Block ID: ${writingBlockId}`);

      console.log("\n=== Test Writing Content (paste this in the editor) ===");
      console.log(`
Remote work has revolutionized how we think about employment. One of the most significant benefits is the flexibility it offers. Employees can structure their day around personal commitments, leading to improved work-life balance. Parents can attend school events, and everyone can avoid the stress of rush hour commutes.

Regarding costs, employees save money on transportation. However, the full picture of employer savings remains to be explored in detail.

Interestingly, many companies are also discovering that remote workers report higher job satisfaction. This unexpected benefit has led to improved retention rates across industries. Some organizations have even found that productivity increases when employees work from home.
      `.trim());

      console.log("\n=== Expected Drift Detection Results ===");
      console.log("- Child 1 (flexibility/work-life): COVERED - first paragraph addresses this");
      console.log("- Child 2 (cost savings): PARTIAL - mentions employee savings but not employer savings");
      console.log("- Child 3 (environmental): MISSING - not mentioned at all");
      console.log("- Orphan content: Last paragraph about job satisfaction and productivity");

      setTimeout(() => {
        ws.close();
        resolve();
      }, 1000);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      reject(error);
    });

    ws.on("close", () => {
      console.log("\nDisconnected from PartyKit");
    });
  });
}

// Get room ID from command line
const roomId = process.argv[2];

if (!roomId) {
  console.log("Usage: npx ts-node scripts/create-test-data.ts <room-id>");
  console.log("\nTo get a room ID:");
  console.log("1. Go to the app and create a new document");
  console.log("2. Copy the ID from the URL: /room/<room-id>");
  process.exit(1);
}

createTestData(roomId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
