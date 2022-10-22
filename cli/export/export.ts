import { Command } from "cliffy";

import logic from "./logic.ts";

export default new Command()
  .description("Export tracks from your desktop DAW.")
  .command("logic", logic);
