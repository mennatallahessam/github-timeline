import { createApp } from './app';
import { createTimelineStore } from './db';

const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  const store = await createTimelineStore();
  const app = createApp({ store });

  const server = app.listen(PORT, () => {
    console.warn(
      `[GitHub Timeline Server] Listening on http://localhost:${PORT} (DB driver: ${store.driver})`,
    );
  });

  const shutdown = async () => {
    server.close();
    await store.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();

