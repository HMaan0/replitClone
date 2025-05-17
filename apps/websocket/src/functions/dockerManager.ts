// dockerManager.js - Manage container file system and execute code
import Docker from "dockerode";
import tarfs from "tar-fs";
import path from "path";
import fs from "fs";

class DockerManager {
  docker: any;
  containerName: string;
  constructor(containerName = "node") {
    this.docker = new Docker(); // Connects to Docker socket by default
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

      // Wait a moment for container to fully start
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return container;
  }

  // List files in a directory within the container
  async listFiles(dirPath = "/") {
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
        // Parse the ls output to get file information
        const lines = output.split("\n").filter((line) => line.trim() !== "");

        // Skip the first line (total) and parse the rest
        const files = lines
          .slice(1)
          .map((line) => {
            const parts = line.split(/\s+/);
            // Basic parsing of ls -la output
            // Format: permissions links owner group size month day time name
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

  // Get the content of a file from the container
  async getFileContent(filePath: string) {
    const container = await this.ensureContainerRunning();

    // Create a temporary directory to extract the file
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get the file from the container as a tar stream
    const options = {
      path: filePath,
    };

    const tarStream = await container.getArchive(options);

    return new Promise((resolve, reject) => {
      // Extract the tar stream to the temp directory
      tarStream
        .pipe(tarfs.extract(tempDir))
        .on("finish", async () => {
          try {
            // The file is extracted with its full path, we need the basename
            const baseName = path.basename(filePath);
            const extractedPath = path.join(tempDir, baseName);

            if (fs.existsSync(extractedPath)) {
              const content = fs.readFileSync(extractedPath, "utf8");

              // Clean up the temp file
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
        .on("error", (error: any) => {
          reject(error);
        });
    });
  }

  // Write content to a file in the container
  async writeFile(filePath: any, content: any) {
    const container = await this.ensureContainerRunning();

    // Create a temporary directory and file
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const tempFilePath = path.join(tempDir, fileName);

    // Write the content to a temporary file
    fs.writeFileSync(tempFilePath, content);

    // Create a tar pack of the file
    const tarStream = tarfs.pack(tempDir, {
      entries: [fileName],
    });

    // Extract the directory from the file path
    const dirPath = path.dirname(filePath);

    return new Promise((resolve, reject) => {
      container
        .putArchive(tarStream, { path: dirPath })
        .then(() => {
          // Clean up the temp file
          fs.unlinkSync(tempFilePath);
          resolve({ success: true });
        })
        .catch((error: any) => {
          // Clean up the temp file even on error
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          reject(error);
        });
    });
  }

  // Delete a file or directory in the container
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

  // Create a directory in the container
  async createDirectory(dirPath: any) {
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

  // Execute a Node.js script in the container
  async executeNodeScript(scriptPath: any, args = []) {
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

      stream.on("data", (chunk: { toString: () => any }) => {
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
