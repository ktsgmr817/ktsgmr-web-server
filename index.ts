import net from "net";

// new connections callback
const newConnectionCallback = (socket: net.Socket) => {
  console.log("new connection", socket.remoteAddress, socket.remotePort);
  // read and write
  socket.on("end", () => {
    // FIN received. The connection will be closed automatically.
    console.log("EOF.");
  });
  socket.on("data", (data: Buffer) => {
    console.log("data:", data);
    // echo back
    socket.write(data);

    // actively closed the connection if the data contains 'q'
    if (data.includes("q")) {
      console.log("closing.");
      socket.end();
    }
  });
};

// create a Listening Socket
const server: net.Server = net.createServer();
// register a callback
server.on("connection", newConnectionCallback);
// error handling
server.on("error", (err: Error) => {
  throw err;
});
// bind and listen on an address
server.listen({ host: "127.0.0.1", port: 1234 });
