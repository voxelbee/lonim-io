// SETTINGS
const VIEW_DISTANCE = 4;
const TILES_PER_CHUNK = 16;
// SEND SETTINGS

console.log("Server starting...");
var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server,{});

// The socket to use for the server
server.listen(2000);

console.log("Server started");

// Send client files to the client
app.get("/", function(req, res)
{
  res.sendFile(__dirname + "/client/index.html");
});
app.use("/client", express.static(__dirname + "/client"));

// Load in fast noise libary
const fastnoise = require('fastnoisejs');
const noise = fastnoise.Create(10)
 
noise.SetNoiseType(fastnoise.Simplex)

// All the players on the server
var players = {};

// Map of all the chunks that are currently loaded
var chunks = {};

// When the client is connected
io.sockets.on("connection", function(socket)
{
  // Create a unique id.
  var uuid = makeUUID();

  // Add the player to the players map
  players[uuid] = {position: {x: 0, y: 0}, socket: socket, loaded: false};
  console.log("Conected: " + uuid);

  // When the player disconects
  socket.on("disconnect", function()
  {
    delete players[uuid];
    console.log("Disconected: " + uuid);
  });

  socket.on("loaded", function() {
    players[uuid].loaded = true;
  })
});

// Creates a unique id
function makeUUID() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 4; i++) {
      for( var j = 0; j < 6; j++ ) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      if (i != 3) {
        text += "-";
      }
    }
    return text;
}

// Main update loop
setInterval(function()
{
  // Get all the players
  const playerKeys = Object.keys(players);
  for(var uuid of playerKeys) {
    if(!players[uuid].loaded) {
      continue;
    }

    var playerChunkX = Math.floor(players[uuid].position.x / TILES_PER_CHUNK);
    var playerChunkY = Math.floor(players[uuid].position.y / TILES_PER_CHUNK);

    for(var i = -VIEW_DISTANCE + 1; i < VIEW_DISTANCE; i++) {
      for(var j = -VIEW_DISTANCE + 1; j < VIEW_DISTANCE; j++) {
        var currentChunkX = playerChunkX + i;
        var currentChunkY = playerChunkY + j;

        // Checks if the current chunk the player is in has been loaded
        if(!(chunks.hasOwnProperty(currentChunkX + "," + currentChunkY))) {
          // Generate the chunk and add it to the loaded chunks on the server
          chunks[(currentChunkX + "," + currentChunkY)] = generateChunk(currentChunkX, currentChunkY);

          // Send the chunk to the player
          players[uuid].socket.emit("chunk-data", {
            position: {x: currentChunkX, y: currentChunkY},
            chunk: chunks[(currentChunkX + "," + currentChunkY)]
          });
        }
      }
    }
  }
}, 1000 / 120)

function generateChunk(x, y) {
  console.log("Generating chunk: " + x + "," + y);

  var tiles = [];

  for(var i = 0; i < TILES_PER_CHUNK; i++) {
    for(var j = 0; j < TILES_PER_CHUNK; j++) {
      var noiseValue = Math.floor((noise.GetNoise((x * TILES_PER_CHUNK) + i, (y * TILES_PER_CHUNK) + j) + 1) * 128);
      tiles.push(noiseValue);
    }
  }

  return {tiles: tiles};
}