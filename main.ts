import * as log from "log";

import main from "cli/main.ts";

if (import.meta.main) {
  try {
    await main.parse(Deno.args);
    Deno.exit(0);
  } catch (error) {
    log.error(error);
    Deno.exit(1);
  }
}
