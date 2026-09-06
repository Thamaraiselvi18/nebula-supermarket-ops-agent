import { inventoryTools } from "../tools/inventory.js";
import { billingTools } from "../tools/billing.js";
import { khataTools } from "../tools/khata.js";
import { analyticsTools } from "../tools/analytics.js";
import { memoryTools } from "../tools/memory.js";

export const tools = {
  ...inventoryTools,
  ...billingTools,
  ...khataTools,
  ...analyticsTools,
  ...memoryTools
};
