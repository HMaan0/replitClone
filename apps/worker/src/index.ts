import { redis } from "@repo/redis/src";
import { Queue, ALL_IPS } from "@repo/types/src";
import { Up } from "./functions/up";
import { Down } from "./function/down";
async function queueWorker() {
  const redisClient = await redis();
  while (true) {
    try {
      const queue = await redisClient.brPop("project", 0);
      console.log(queue);
      if (queue) {
        const parsedQueue: Queue = JSON.parse(queue.element);
        if (parsedQueue.type === "up") {
          const serverInfo = await Up();
          const project = parsedQueue.project;
          await redisClient.publish(
            project.id,
            JSON.stringify({ project, ip: serverInfo[0].ip })
          );
        } else if (parsedQueue.type === "down") {
          //TODO: ssh in to instance and save files to s3
          const ip = parsedQueue.ip;
          if (ip) {
            const ALL_IPS = await redisClient.get("ALL_IPS");

            if (ALL_IPS) {
              const ips: ALL_IPS = await JSON.parse(ALL_IPS);
              const instance = ips.find((instance) => instance.ip === ip);
              const instanceId = instance?.id;
              if (instanceId) {
                await Down(instanceId);
                if (ips.length === 1) {
                  await redisClient.del("ALL_IPS");
                } else {
                  const removeIp = ips.filter((id) => id.id !== instanceId);
                  const stringifyReducedALL_IPS = JSON.stringify(removeIp);
                  await redisClient.set("ALL_IPS", stringifyReducedALL_IPS);
                }
              }
            }
          }
        } else {
          throw new Error("Type in queue is unknown");
        }
      }
    } catch (error) {
      console.error("Error popping from queue push back to queue", error);
    }
  }
}
queueWorker();
