import net from "net";

type TCPconn = {
  socket: net.Socket;
  err: null | Error;
  ended: boolean;
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
};

const soInit = (socket: net.Socket): TCPconn => {
  const conn: TCPconn = {
    socket,
    err: null,
    ended: false,
    reader: null,
  };
  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader);
    conn.socket.pause();
    conn.reader!.resolve(data);
    conn.reader = null;
  });
  socket.on("end", () => {
    conn.ended = true;
    if (conn.reader) {
      conn.reader.resolve(Buffer.from(""));
      conn.reader = null;
    }
  });
  socket.on("error", (err) => {
    conn.err = err;
    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });
  return conn;
};

const soRead = (conn: TCPconn): Promise<Buffer> => {
  console.assert(!conn.reader);
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }
    if (conn.ended) {
      resolve(Buffer.from(""));
      return;
    }

    conn.reader = { resolve, reject };
    conn.socket.resume();
  });
};

const soWrite = (conn: TCPconn, data: Buffer): Promise<void> => {
  console.assert(data.length > 0);
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }

    conn.socket.write(data, (err?: Error) => {
      if (err) {
        reject(err);
      }
      else {
        resolve();
      }
    });
  });
};

const serveClient = async (socket: net.Socket) => {
  const conn = soInit(socket);
  while (true) {
    const data = await soRead(conn);
    if (data.length === 0) {
      console.log("end connection");
      break;
    }

    console.log("data", data);
    // バックプレッシャーのために、soWriteではPromiseを返して完了まで待機する
    // OSの送信バッファが溜まってしまいメモリリークにつながる
    await soWrite(conn, data);
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
