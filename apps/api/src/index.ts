import { env } from "./config/env.js";
import { initTelemetry } from "./lib/logger.js";
import { createApp } from "./app.js";

initTelemetry();

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`chessgg API listening on port ${env.PORT}`);
});
