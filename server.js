console.log("Server starting...");
var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server,{});
server.listen(2000);
console.log("Server started");

app.get("/", function(req, res)
{
  res.sendFile(__dirname + "/client/index.html");
});
app.use("/client", express.static(__dirname + "/client"));

var players = {};
var playerUUIDs = [];

io.sockets.on("connection", function(socket)
{
  var uuid = makeUUID();
  var posX = Math.random() * 1000;
  var posY = Math.random() * 1000;
  players[uuid] =
  {
    uuid:uuid,
    positionX:posX,
    positionY:posY,
    rotation:0
  };
  playerUUIDs.push(uuid);
  console.log("Conected: " + uuid);
  socket.emit("all-current-players",
  {
    playerUUIDs:playerUUIDs,
    players:players,
    uuid:uuid
  });

  io.sockets.emit("player-connected",
  {
    uuid:uuid,
    positionX:posX,
    positionY:posY,
    rotation:players[uuid].rotation
  });

  socket.on("nickname", function(data)
  {
    socket.nickname = data.nickname;
  });

  socket.on("disconnect", function()
  {
    delete players[uuid];
    playerUUIDs.splice(playerUUIDs.indexOf(uuid), 1);
    console.log("Disconected: " + uuid);
    io.sockets.emit("player-disconected", {uuid:uuid});
  });

  socket.on("down-key-pressed", function()
  {
    players[uuid].downKey = true;
  });

  socket.on("up-key-pressed", function()
  {
    players[uuid].upKey = true;
  });

  socket.on("left-key-pressed", function()
  {
    players[uuid].leftKey = true;
  });

  socket.on("right-key-pressed", function()
  {
    players[uuid].rightKey = true;
  });

  socket.on("down-key-released", function()
  {
    players[uuid].downKey = false;
  });

  socket.on("up-key-released", function()
  {
    players[uuid].upKey = false;
  });

  socket.on("left-key-released", function()
  {
    players[uuid].leftKey = false;
  });

  socket.on("right-key-released", function()
  {
    players[uuid].rightKey = false;
  });
});

function makeUUID()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 4; i++)
    {
      for( var j = 0; j < 6; j++ )
      {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      if (i != 3)
      {
        text += "-";
      }
    }
    return text;
}

setInterval(function()
{
  for (var i = 0; i < playerUUIDs.length; i++)
  {
    if (players[playerUUIDs[i]].downKey)
    {
      players[playerUUIDs[i]].positionY += 5;
    }
    if (players[playerUUIDs[i]].upKey)
    {
      players[playerUUIDs[i]].positionY -= 5;
    }
    if (players[playerUUIDs[i]].leftKey)
    {
      players[playerUUIDs[i]].positionX -= 5;
    }
    if (players[playerUUIDs[i]].rightKey)
    {
      players[playerUUIDs[i]].positionX += 5;
    }
    io.sockets.emit("positions", players);
  }
}, 1000/25)
