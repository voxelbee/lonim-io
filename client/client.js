// SETTINGS
const TILES_PER_CHUNK = 16;
const VIEW_DISTANCE = 4;
const FPS = 60;
const TILE_SIZE = 32;
const DEBUG = false;
// END SETTINGS

// Current size of the window
var width = window.innerWidth;
var height = window.innerHeight;

// Create the socket
var socket = io();

// setup renderer and ticker
var renderer = new PIXI.Renderer({ width: width, height: height, backgroundColor: 0x000000 });
document.body.appendChild(renderer.view);

// Create a container for the chunk and add it to the stage
const camera = new PIXI.Container();

// Create different z layers
var underLayer = new PIXI.Container();
camera.addChild(underLayer);

var overLayer = new PIXI.Container();
camera.addChild(overLayer);

// The reference to the tile set being used
var tileSet;

// Load in the tile set
PIXI.Loader.shared.add("client/assets/charsets/dos40/data.json").load(setup);

var chunks = {};
var entities = {};

function setup() {
  tileSet = PIXI.Loader.shared.resources["client/assets/charsets/dos40/data.json"].spritesheet;
  for(var i = 0; i < 256; i++) {
    // Set it to nearest scale
    tileSet.textures["dos40-" + i + ".png"].baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  }
  // Send a loaded message to the sever
  socket.emit("loaded");
}

// setup RAF
var oldTime = Date.now();

requestAnimationFrame(animate);
function animate() {
    var newTime = Date.now();
    var deltaTime = newTime - oldTime;
    oldTime = newTime;	
    if (deltaTime < 0) deltaTime = 0;
    if (deltaTime > 1000) deltaTime = 1000;
    var deltaFrame = deltaTime * 60 / 1000; //1.0 is for single frame
	
    renderer.render(camera);

    requestAnimationFrame(animate);
}

// If the window has been resized
window.onresize = function(event) {
  width = window.innerWidth;
  height = window.innerHeight;

  // Resize the app
  renderer.resize(width, height);
};

// When a chunk is sent to the client
socket.on("chunk-data", function(data) {
  for(var i = 0; i < TILES_PER_CHUNK; i++) {
    for(var j = 0; j < TILES_PER_CHUNK; j++) {
      setTile(i + (data.position.x * TILES_PER_CHUNK), j + (data.position.y * TILES_PER_CHUNK), data.chunk.tiles[i * TILES_PER_CHUNK + j]);
    }
  }
});

socket.on("set-tile", function(data) {
  setTile(data.x, data.x, data.tile);
});

socket.on("add-entity", function(data) {
  //Create the tile sprite from the texture
  var tile = new PIXI.Sprite(tileSet.textures["dos40-" + data.charId + ".png"]);

  //Position the tile sprite in the chunk
  tile.x = data.x * TILE_SIZE;
  tile.y = data.y * TILE_SIZE;
  tile.height = TILE_SIZE;
  tile.width = TILE_SIZE;

  // Set the color of the tile
  tile.tint = data.colorId;

  entities[data.uuid] = tile;
  overLayer.addChild(entities[data.uuid]);
});

socket.on("update-entity", function(data) {
  entities[data.uuid].x = data.x * TILE_SIZE;
  entities[data.uuid].y = data.y * TILE_SIZE;
});

socket.on("remove-entity", function(data) {
  overLayer.removeChild(entities[data.uuid]);
});

socket.on("remove-chunk", function(data) {
  underLayer.removeChild(chunks[data.x + "," + data.y].container);
  delete chunks[data.x + "," + data.y];
});

// Sets the tile at location specified with object tileData {charId: , colorId: }
function setTile(x, y, tileData) {
  var chunkX = Math.floor(x / TILES_PER_CHUNK);
  var chunkY = Math.floor(y / TILES_PER_CHUNK);
  x = x % TILES_PER_CHUNK;
  y = y % TILES_PER_CHUNK;
  if(x < 0) x += TILES_PER_CHUNK;
  if(y < 0) y += TILES_PER_CHUNK;

  //Create the tile sprite from the texture
  var tile = new PIXI.Sprite(tileSet.textures["dos40-" + tileData.charId + ".png"]);

  //Position the tile sprite in the chunk
  tile.x = x * TILE_SIZE;
  tile.y = y * TILE_SIZE;
  tile.height = TILE_SIZE;
  tile.width = TILE_SIZE;

  // Set the color of the tile
  tile.tint = tileData.colorId;

  // If the chunk exists add the tile to the chunk and remove old tile
  if(chunks.hasOwnProperty(chunkX + "," + chunkY)) {
    // If there was a previous tile at this location remove it
    if(chunks[chunkX + "," + chunkY].tiles.hasOwnProperty(x + "," + y)) {
      chunks[chunkX + "," + chunkY].container.removeChild(chunks[chunkX + "," + chunkY].tiles[x + "," + y]);
    }
  } else {
    // Creates a new chunk data object
    chunks[chunkX + "," + chunkY] = {
      container: new PIXI.Container(),
      tiles: {}
    };
    underLayer.addChild(chunks[chunkX + "," + chunkY].container);

    // Put the chunk contain in the right location
    chunks[chunkX + "," + chunkY].container.x = chunkX * TILES_PER_CHUNK * TILE_SIZE;
    chunks[chunkX + "," + chunkY].container.y = chunkY * TILES_PER_CHUNK * TILE_SIZE;

    // Add chunk borders to be visible
    if(DEBUG) {
      var graphics = new PIXI.Graphics();
      graphics.lineStyle(5, 0xFF0000);
      graphics.drawRect(0, 0, TILES_PER_CHUNK * TILE_SIZE, TILES_PER_CHUNK * TILE_SIZE);
      chunks[chunkX + "," + chunkY].container.addChild(graphics);
    }
  }

  if(tileData.charId != 0) {
    //Add the tile to the stage
    chunks[chunkX + "," + chunkY].container.addChild(tile);
    chunks[chunkX + "," + chunkY].tiles[x + "," + y] = tile;
  }
}

socket.on("player-position", function(data) {
  camera.x = (width / 2) - (data.x * TILE_SIZE);
  camera.y = (height / 2) - (data.y * TILE_SIZE);
})


document.addEventListener('keydown', function(event) {
  if(event.code == "KeyW") {
    socket.emit("move-key", {key: "up", press: true});
    console.print("Hello");
  } else if(event.code == "KeyD") {
    socket.emit("move-key", {key: "right", press: true});
  } else if(event.code == "KeyS") {
    socket.emit("move-key", {key: "down", press: true});
  } else if(event.code == "KeyA") {
    socket.emit("move-key", {key: "left", press: true});
  }
});

document.addEventListener('keyup', function(event) {
  if(event.code == "KeyW") {
    socket.emit("move-key", {key: "up", press: false});
  } else if(event.code == "KeyD") {
    socket.emit("move-key", {key: "right", press: false});
  } else if(event.code == "KeyS") {
    socket.emit("move-key", {key: "down", press: false});
  } else if(event.code == "KeyA") {
    socket.emit("move-key", {key: "left", press: false});
  }
});