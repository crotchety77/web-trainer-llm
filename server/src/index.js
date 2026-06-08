import { app } from "./app.js";
import { config } from "./config.js";
import { initializePistonLanguages } from "./modules/pistonExecutor.js";

// Запускаем асинхронную проверку и установку языков для Piston
initializePistonLanguages();

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
