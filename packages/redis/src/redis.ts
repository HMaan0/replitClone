import { createClient } from "redis";

export async function redis() {
  let client;
  if (process.env.REDIS_PASSWORD && process.env.REDIS_HOST) {
    client = createClient({
      username: "default",
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: 1899,
      },
    });
  } else {
    client = createClient({});
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}
