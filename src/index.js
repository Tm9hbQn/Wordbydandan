const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const cors = require('cors');
const path = require("path");
const chatController = require("./controllers/chatController");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./public/index.html"));
});

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
  },
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

chatController(io);
