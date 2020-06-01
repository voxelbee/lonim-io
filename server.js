// SETTINGS
const VIEW_DISTANCE = 4;
const TILES_PER_CHUNK = 16;
// END SETTINGS

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
  players[uuid] = {
    position: {x: 0, y: 0},
    lastSentPosition: {x: Math.random(), y: 0},
    color: Math.random() * 0xFFFFFF,
    socket: socket,
    loaded: false,
    sentChunks: {},
    velocity: {x: 0, y: 0},
    maxMovementSpeed: 0.4,
    friction: 0.6};
  console.log("Conected: " + uuid);

  // Add the joined player to everyones view except this player
  socket.broadcast.emit("add-entity", {
    x: players[uuid].position.x,
    y: players[uuid].position.y,
    charId: 1,
    colorId: players[uuid].color,
    uuid: uuid
  });

  // When the player disconects
  socket.on("disconnect", function()
  {
    delete players[uuid];
    console.log("Disconected: " + uuid);
    socket.broadcast.emit("remove-entity", {uuid: uuid});
  });

  socket.on("loaded", function() {
    players[uuid].loaded = true;
    socket.emit("player-position", { x: players[uuid].position.x, y: players[uuid].position.y });
    // Get all the players
    const playerKeys = Object.keys(players);
    for(var uuidL of playerKeys) {
      // Add the player to the client
      socket.emit("add-entity", {
        x: players[uuidL].position.x,
        y: players[uuidL].position.y,
        charId: 1,
        colorId: players[uuidL].color,
        uuid: uuidL
      });
    }
  });

  socket.on("move-key", function(data) {
    if(data.key == "space") {
      players[uuid].position.y -= 2;
    } else if(data.key == "left") {
      players[uuid].velocity.x = -players[uuid].maxMovementSpeed;
    } else if(data.key == "right") {
      players[uuid].velocity.x = players[uuid].maxMovementSpeed;
    }
  });

  socket.on("move-touch", function(data) {
    var xLength = Math.min(Math.max(data.xDistance, -500), 500);
    var yLength = Math.min(Math.max(data.yDistance, -500), 500);

    players[uuid].velocity.x = (xLength / 500) * players[uuid].maxMovementSpeed;
    players[uuid].velocity.y = (yLength / 500) * players[uuid].maxMovementSpeed;
  });
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

    // Send all chunks that are needed to the player
    for(var i = -VIEW_DISTANCE + 1; i < VIEW_DISTANCE; i++) {
      for(var j = -VIEW_DISTANCE + 1; j < VIEW_DISTANCE; j++) {
        var currentChunkX = playerChunkX + i;
        var currentChunkY = playerChunkY + j;

        // Checks if the current chunk the player is in has been loaded
        if(!chunks.hasOwnProperty(currentChunkX + "," + currentChunkY)) {
          // Generate the chunk and add it to the loaded chunks on the server
          chunks[(currentChunkX + "," + currentChunkY)] = generateChunk(currentChunkX, currentChunkY);

          // Send the chunk to the player
          players[uuid].socket.emit("chunk-data", {
            position: {x: currentChunkX, y: currentChunkY},
            chunk: chunks[(currentChunkX + "," + currentChunkY)]
          });

          // Set the chunk as sent
          players[uuid].sentChunks[currentChunkX + "," + currentChunkY] = true;
        } else {
          // If the player hasn't recived this chunk
          if(!players[uuid].sentChunks.hasOwnProperty(currentChunkX + "," + currentChunkY)) {
            // Send the chunk to the player
            players[uuid].socket.emit("chunk-data", {
              position: {x: currentChunkX, y: currentChunkY},
              chunk: chunks[(currentChunkX + "," + currentChunkY)]
            });
            // Set the chunk as sent
            players[uuid].sentChunks[currentChunkX + "," + currentChunkY] = true;
          }
        }
      }
    }

    // Remove chunks that are not needed by the clients
    const sentChunkKeys = Object.keys(players[uuid].sentChunks)
    for(var sentChunk of sentChunkKeys) {
      var position = sentChunk.split(",");
      if(Math.sqrt(Math.pow(Math.abs(position[0] - playerChunkX), 2) + Math.pow(Math.abs(position[1] - playerChunkY), 2)) > VIEW_DISTANCE) {
        delete players[uuid].sentChunks[sentChunk];
        players[uuid].socket.emit("remove-chunk", {x: position[0], y: position[1]});
      }
    }

    updatePlayer(uuid);
  }
}, 1000 / 25);

function updatePlayer(uuid) {
  if(players[uuid].velocity.x < 0.1 && players[uuid].velocity.x > -0.1) players[uuid].velocity.x = 0;
  if(players[uuid].velocity.y < 0.1 && players[uuid].velocity.y > -0.1) players[uuid].velocity.y = 0;

  players[uuid].velocity.x *= players[uuid].friction;
  players[uuid].velocity.y *= players[uuid].friction;
  players[uuid].velocity.y = Math.min(Math.max(players[uuid].velocity.y + (players[uuid].maxMovementSpeed / 3), -players[uuid].maxMovementSpeed), players[uuid].maxMovementSpeed);

  checkCollisions(uuid);

  players[uuid].position.x += players[uuid].velocity.x;
  players[uuid].position.y += players[uuid].velocity.y;

  sendPlayerPosition(uuid);
}

function sendPlayerPosition(uuid) {
  if(players[uuid].lastSentPosition.x != players[uuid].position.x
    || players[uuid].lastSentPosition.y != players[uuid].position.y) {
    const playerKeys = Object.keys(players);
    for(var uuidL of playerKeys) {
      if(!players[uuidL].loaded) {
        continue;
      }
      players[uuidL].socket.emit("update-entity", {
        x: Math.floor(players[uuid].position.x),
        y: Math.floor(players[uuid].position.y),
        uuid: uuid
      });
    }
    players[uuid].lastSentPosition.x = players[uuid].position.x;
    players[uuid].lastSentPosition.y = players[uuid].position.y;
  }

  players[uuid].socket.emit("player-position", {x: Math.floor(players[uuid].position.x), y: Math.floor(players[uuid].position.y)});
}

function checkCollisions(uuid) {
  if(players[uuid].velocity.x > 0) {
    if(getTile(players[uuid].position.x + 1, players[uuid].position.y).charId != 0) {
      players[uuid].velocity.x = 0;
    }
  } else if(players[uuid].velocity.x < 0) {
    if(getTile(players[uuid].position.x - 1, players[uuid].position.y).charId != 0) {
      players[uuid].velocity.x = 0;
    }
  }

  if(players[uuid].velocity.y > 0) {
    if(getTile(players[uuid].position.x, players[uuid].position.y + 1).charId != 0) {
      players[uuid].velocity.y = 0;
    }
  } else if(players[uuid].velocity.y < 0) {
    if(getTile(players[uuid].position.x, players[uuid].position.y - 1).charId != 0) {
      players[uuid].velocity.y = 0;
    }
  }
}

// Chunk culling function
setInterval(function()
{
  // Find out if any player is using the loaded chunk
  var usedChunks = {};
  const playerKeys = Object.keys(players);
  for(var uuid of playerKeys) {
    const sentChunkKeys = Object.keys(players[uuid].sentChunks)
      for(var sentChunk of sentChunkKeys) {
        usedChunks[sentChunk]++;
      }
  }

  // Delete chunks that are not used
  const chunkKeys = Object.keys(players);
  for(var chunk of chunkKeys) {
    if(chunkKeys[chunk] == 0) {
      delete chunks[chunkKeys];
    }
  }
}, 1000);

// Generates terrain and tiles for a chunk
function generateChunk(x, y) {
  var tiles = [];

  for(var i = 0; i < TILES_PER_CHUNK; i++) {
    for(var j = 0; j < TILES_PER_CHUNK; j++) {
      var noiseValue = generateTerrainTile((x * TILES_PER_CHUNK) + i, (y * TILES_PER_CHUNK) + j);
      tiles.push(noiseValue);
    }
  }

  return {tiles: tiles};
}

function getTile(x, y) {
  var chunkX = Math.floor(x / TILES_PER_CHUNK);
  var chunkY = Math.floor(y / TILES_PER_CHUNK);
  x = Math.floor(x) % TILES_PER_CHUNK;
  y = Math.floor(y) % TILES_PER_CHUNK;
  if(x < 0) x += TILES_PER_CHUNK;
  if(y < 0) y += TILES_PER_CHUNK;

  if(chunks.hasOwnProperty(chunkX + "," + chunkY)) {
    return chunks[chunkX + "," + chunkY].tiles[x * TILES_PER_CHUNK + y];
  } else {
    return {charId: 0, colorId: 0};
  }
}

// Returns a tile object {charId: , colorId: } for the specified location
function generateTerrainTile(x, y) {
  const NOISE_SCALE = 3;

  var terrainLevels = (noise.GetNoise(x * NOISE_SCALE, 0) + 1) / 2;
  var noiseValue = 0;
  if(y > terrainLevels * 50) {
    noiseValue = 128;
  }
  //var noiseValue = Math.floor((terrainLevels + 1) * 128);
  return {charId: noiseValue, colorId: 0x00FF00};
}

// Sets a tile in a specified location tile data = {charId: , colorId: }
function setTile(x, y, tileData) {
  // Send the tile to all the clients
  io.emit("set-tile", {
    x: x,
    y: y,
    tile: tileData
  });

  var chunkX = Math.floor(x / TILES_PER_CHUNK);
  var chunkY = Math.floor(y / TILES_PER_CHUNK);
  x = x % TILES_PER_CHUNK;
  y = y % TILES_PER_CHUNK;
  if(x < 0) x += TILES_PER_CHUNK;
  if(y < 0) y += TILES_PER_CHUNK;

  // Set the chunk to contain that tile
  chunks[chunkX + "," + chunkY].tiles[x * TILES_PER_CHUNK + y] = tileData;
}