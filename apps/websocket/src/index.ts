import { WebSocketServer } from "ws";
import DockerManager from "./functions/dockerManager";
const ws = new WebSocketServer({ port: 8080 });
const dockerManager = new DockerManager("node");
ws.on("connection", function connection(socket) {
  socket.on("error", console.error);

  socket.on("message", async (message) => {
    const messageString = message.toString("utf-8");
    if (messageString === "files") {
      const files = await dockerManager.getFileContent("/app/index.js");
      console.log(files);
      //socket.send(files)
    }
    if (messageString === "write") {
      const files = await dockerManager.writeFile(
        "/app/index.js",
        `console.log("THIS IS WRITTEN FROM WEBSOCKET")`
      );
      console.log(files);
    }
  });

  socket.send("Hello! Message From Server!!");
});
console.log("server started");
