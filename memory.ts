import { tool } from "ai";
import { z } from "zod";

import {
  db,
} from "../db/schema.js";


/* =========================================================
   SET PREFERENCE
========================================================= */

const setPreference = tool({
  description: `
Save a shop owner's preference permanently.

Examples:
- remember my shop name is ABC Stores
- remember GSTIN is ...
- default payment is UPI
- remember my invoice shop name

Preferences must persist across Telegram conversations.
  `,

  inputSchema: z.object({
    ownerKey:
      z.string(),

    key:
      z.string()
        .min(1),

    value:
      z.string()
        .min(1),
  }),

  execute: async ({
    ownerKey,
    key,
    value,
  }) => {

    db.prepare(`
      INSERT INTO preferences (
        owner_key,
        key,
        value
      )
      VALUES (?, ?, ?)

      ON CONFLICT(owner_key, key)
      DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      ownerKey,
      key.trim(),
      value.trim()
    );


    return {
      success: true,

      key:
        key.trim(),

      value:
        value.trim(),

      message:
        `Preference "${key.trim()}" saved.`,
    };
  },
});


/* =========================================================
   GET PREFERENCE
========================================================= */

const getPreference = tool({
  description: `
Retrieve a saved preference for the current owner.

Use this when a previous preference affects the current operation.
  `,

  inputSchema: z.object({
    ownerKey:
      z.string(),

    key:
      z.string()
        .min(1),
  }),

  execute: async ({
    ownerKey,
    key,
  }) => {

    const row =
      db.prepare(`
        SELECT
          key,
          value,
          updated_at
        FROM preferences
        WHERE
          owner_key = ?
          AND key = ?
        LIMIT 1
      `).get(
        ownerKey,
        key.trim()
      ) as any;


    if (!row) {
      return {
        success: true,
        found: false,
        key,
      };
    }


    return {
      success: true,

      found: true,

      key:
        row.key,

      value:
        row.value,

      updatedAt:
        row.updated_at,
    };
  },
});


/* =========================================================
   GET ALL PREFERENCES
========================================================= */

const getPreferences = tool({
  description: `
Get all saved preferences for the current shop owner.
  `,

  inputSchema: z.object({
    ownerKey:
      z.string(),
  }),

  execute: async ({
    ownerKey,
  }) => {

    const rows =
      db.prepare(`
        SELECT
          key,
          value,
          updated_at
        FROM preferences
        WHERE owner_key = ?
        ORDER BY key
      `).all(
        ownerKey
      ) as any[];


    return {
      success: true,

      preferences:
        rows.map(
          (row) => ({
            key:
              row.key,

            value:
              row.value,

            updatedAt:
              row.updated_at,
          })
        ),
    };
  },
});


/* =========================================================
   EXPORT
========================================================= */

export const memoryTools = {
  set_preference:
    setPreference,

  get_preference:
    getPreference,

  get_preferences:
    getPreferences,
};