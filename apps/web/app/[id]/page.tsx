"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  async function sendMessage() {
    if (socket) {
      socket.send(message);
    }
  }
  useEffect(() => {
    const newSocket = new WebSocket("ws://localhost:8080");
    newSocket.onopen = () => {
      console.log("connected to websocket");
      newSocket.send("Hello server");
    };
    newSocket.onmessage = (message) => {
      console.log("message from server");
      console.log(message.data);
    };
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  return (
    <>
      <section className="flex flex-col p-50 gap-20 justify-center items-center w-full">
        <input
          className=" p-3  w-full rounded-xl bg-gray-900"
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          placeholder="Message here"
        />
        <button
          className="bg-gray-600 font-medium p-3 w-max rounded-xl cursor-pointer hover:bg-gray-600/90"
          onClick={sendMessage}
        >
          send Message
        </button>
      </section>
    </>
  );
}
