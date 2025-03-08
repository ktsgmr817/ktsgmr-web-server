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

export const soInit = (socket: net.Socket): TCPconn => {
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

export const soRead = (conn: TCPconn): Promise<Buffer> => {
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

export const soWrite = (conn: TCPconn, data: Buffer): Promise<void> => {
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
