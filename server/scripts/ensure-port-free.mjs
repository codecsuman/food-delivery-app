import net from "node:net";

const port = Number(process.env.PORT) || 8001;

const server = net.createServer();

server.once("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\nPort ${port} is already in use.`);
    console.error("Another backend instance is probably running.");
    console.error('Run "npm run kill" to stop it, then start the server again.\n');
  } else {
    console.error(`Could not check port ${port}: ${error.message}`);
  }
  process.exit(1);
});

server.once("listening", () => {
  server.close(() => process.exit(0));
});

server.listen(port);
