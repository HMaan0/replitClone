"use server";
import prisma from "@repo/database/src";
export async function createProject() {
  try {
    const user = await prisma.user.create({
      data: {
        name: "harsh",
      },
    });

    if (user.id) {
      const project = await prisma.project.create({
        data: {
          name: "test app",

          language: "javascript",
          user: {
            connect: { id: user.id },
          },
        },
      });
      return project.id;
    }
  } catch (error) {
    console.error("Error making project", error);
  }
}
