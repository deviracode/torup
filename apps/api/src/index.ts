import "dotenv/config";
import { createApp } from "./app";

const isWorker = process.env.WORKER_ENABLED === "true";

const app = createApp({
  mountInternal: isWorker,
  startSchedulers: isWorker,
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  if (isWorker) {
    console.log("Worker mode enabled: internal routes + in-process schedulers active");
  }
});

export default app;
