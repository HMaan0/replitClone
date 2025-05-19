import Docker from "dockerode";
import tarfs from "tar-fs";
import path from "path";
import fs from "fs";

class DockerManager {
  docker: any;
  containerName: string;
  constructor(containerName = "node") {
    this.docker = new Docker({
      host: "3.99.137.201",
      port: 2375,
      protocol: "http",
    });
    console.log(this.docker);
    this.containerName = containerName;
  }

  async getContainer() {
    const containers = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [this.containerName] }),
    });

    if (containers.length === 0) {
      throw new Error(`Container '${this.containerName}' not found`);
    }

    return this.docker.getContainer(containers[0].Id);
  }

  async ensureContainerRunning() {
    const container = await this.getContainer();
    const info = await container.inspect();

    if (!info.State.Running) {
      console.log(`Starting container: ${this.containerName}`);
      await container.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return container;
  }

  async listFiles(dirPath: string) {
    const container = await this.ensureContainerRunning();

    const exec = await container.exec({
      Cmd: ["ls", "-la", dirPath],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start();

    return new Promise((resolve, reject) => {
      let output = "";

      stream.on("data", (chunk: { toString: () => string }) => {
        output += chunk.toString();
      });

      stream.on("end", () => {
        const lines = output.split("\n").filter((line) => line.trim() !== "");

        const files = lines
          .slice(1)
          .map((line) => {
            const parts = line.split(/\s+/);

            if (parts.length >= 9) {
              const isDirectory = parts[0].startsWith("d");
              const name = parts.slice(8).join(" ");
              return {
                name,
                isDirectory,
                permissions: parts[0],
                size: parseInt(parts[4], 10),
                modified: `${parts[5]} ${parts[6]} ${parts[7]}`,
              };
            }
            return null;
          })
          .filter(Boolean);

        resolve(files);
      });

      stream.on("error", reject);
    });
  }

  async getFileContent(filePath: string) {
    const container = await this.ensureContainerRunning();

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const options = {
      path: filePath,
    };

    const tarStream = await container.getArchive(options);

    return new Promise((resolve, reject) => {
      tarStream
        .pipe(tarfs.extract(tempDir))
        .on("finish", async () => {
          try {
            const baseName = path.basename(filePath);
            const extractedPath = path.join(tempDir, baseName);
            if (fs.existsSync(extractedPath)) {
              const content = fs.readFileSync(extractedPath, "utf8");
              console.log(content);

              fs.unlinkSync(extractedPath);

              resolve(content);
            } else {
              reject(
                new Error(`File ${baseName} not found in the extracted archive`)
              );
            }
          } catch (error) {
            reject(error);
          }
        })
        .on("error", (error: string) => {
          reject(error);
        });
    });
  }

  async writeFile(filePath: string, content: string) {
    const container = await this.ensureContainerRunning();

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const tempFilePath = path.join(tempDir, fileName);
    fs.writeFileSync(tempFilePath, content);

    const tarStream = tarfs.pack(tempDir, {
      entries: [fileName],
    });

    const dirPath = path.dirname(filePath);
    return new Promise((resolve, reject) => {
      container
        .putArchive(tarStream, { path: dirPath })
        .then(() => {
          fs.unlinkSync(tempFilePath);
          resolve({ success: true });
        })
        .catch((error: string) => {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          reject(error);
        });
    });
  }

  async delete(containerPath: string) {
    const container = await this.ensureContainerRunning();
    const isDirectory = containerPath.endsWith("/");

    const rmCommand = isDirectory
      ? ["rm", "-rf", containerPath]
      : ["rm", containerPath];

    const exec = await container.exec({
      Cmd: rmCommand,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start();

    return new Promise((resolve, reject) => {
      let errorOutput = "";

      stream.on("data", (chunk: { toString: () => string }) => {
        errorOutput += chunk.toString();
      });

      stream.on("end", () => {
        if (errorOutput.trim()) {
          reject(new Error(errorOutput.trim()));
        } else {
          resolve({ success: true });
        }
      });

      stream.on("error", reject);
    });
  }

  async createDirectory(dirPath: string) {
    const container = await this.ensureContainerRunning();

    const exec = await container.exec({
      Cmd: ["mkdir", "-p", dirPath],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start();

    return new Promise((resolve, reject) => {
      let errorOutput = "";

      stream.on("data", (chunk: { toString: () => string }) => {
        errorOutput += chunk.toString();
      });

      stream.on("end", () => {
        if (errorOutput.trim()) {
          reject(new Error(errorOutput.trim()));
        } else {
          resolve({ success: true });
        }
      });

      stream.on("error", reject);
    });
  }

  async executeNodeScript(scriptPath: string, args = []) {
    const container = await this.ensureContainerRunning();

    const exec = await container.exec({
      Cmd: ["node", scriptPath, ...args],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start();

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: { toString: () => string }) => {
        const data = chunk.toString();
        stdout += data;
      });

      stream.on("end", () => {
        resolve({
          stdout,
          stderr,
        });
      });

      stream.on("error", reject);
    });
  }
}

export default DockerManager;
