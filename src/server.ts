import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  process.stdout.write(`Server running on port ${env.port}\n`);
});
