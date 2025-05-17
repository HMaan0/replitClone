"use client";

import { useRouter } from "next/navigation";
import { createProject } from "../lib/actions/createProject";

export default function Page() {
  const router = useRouter();
  async function handleClick() {
    const id = await createProject();
    if (id) {
      router.push(`/${id}`);
    }
  }
  return (
    <main>
      <header>
        <nav className="sticky top-0 text-center font-bold ">replit clone</nav>
      </header>
      <section className="flex justify-center items-center mt-10">
        <button
          onClick={handleClick}
          className=" border-zinc-80 p-3 bg-zinc-700 w-max rounded-xl"
        >
          Node js
        </button>
      </section>
    </main>
  );
}
