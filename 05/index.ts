import net from "net";
import { soInit, soRead, soWrite } from "./socket.js";

type DynBuf = {
  data: Buffer;
  length: number;
};

const bufPush = (buf: DynBuf, data: Buffer) => {
  const newLen = buf.length + data.length;
  if (buf.data.length < newLen) {
    // grow the capacity
    let cap = Math.max(buf.data.length, 32);
    while (cap < newLen) {
      cap *= 2;
    }
    const grown = Buffer.alloc(cap);
    buf.data.copy(grown, 0, 0);
    buf.data = grown;
  }
  data.copy(buf.data, buf.length, 0);
  buf.length = newLen;
};

const cutMessage = (buf: DynBuf): null | Buffer => {
  const idx = buf.data.subarray(0, buf.length).indexOf("\n");
  if (idx < 0) {
    return null;
  }
  const msg = Buffer.from(buf.data.subarray(0, idx + 1));
  // remove the data from the front
  bufPop(buf, idx + 1);
  return msg;
};

const bufPop = (buf: DynBuf, len: number): void => {
  buf.data.copyWithin(0, len, buf.length);
  buf.length -= len;
};

const serveClient = async (socket: net.Socket): Promise<void> => {
  const conn = soInit(socket);
  const buf: DynBuf = { data: Buffer.alloc(0), length: 0 };
  while (true) {
    const msg: null | Buffer = cutMessage(buf);
    if (!msg) {
      // メッセージが完成していないのでさらにreadする
      const data = await soRead(conn);
      bufPush(buf, data);
      if (data.length === 0) {
        console.log("end connection");
        return;
      }
      continue;
    }

    if (msg.equals(Buffer.from("quit\n"))) {
      await soWrite(conn, Buffer.from("Bye.\n"));
      return;
    }

    const reply = Buffer.concat([Buffer.from("Echo: "), msg]);
    await soWrite(conn, reply);
  }
};

const newConn = async (socket: net.Socket) => {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  try {
    await serveClient(socket);
  }
  catch (exc) {
    console.error("exception:", exc);
  }
  finally {
    socket.destroy();
  }
};

// create a Listening Socket
const server: net.Server = net.createServer({
  pauseOnConnect: true,
});
// register a callback
server.on("connection", newConn);
// error handling
server.on("error", (err: Error) => {
  throw err;
});
// bind and listen on an address
server.listen({ host: "127.0.0.1", port: 1234 });
