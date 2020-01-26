// SETTINGS
const TILES_PER_CHUNK = 16;
// SEND SETTINGS

// Current size of the window
var width;
var height;

// Is the main page enabled
var mainPageOn = true;

// Create the socket
var socket = io();

// This players unique id
var uuid;

// Size of ascii tiles
const tileSize = 32;

// Create the pixi application
const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x000000,
  resolution: window.devicePixelRatio || 1
});
document.body.appendChild(app.view);

var tileSet;

// Load in the tile set
PIXI.Loader.shared.add("client/assets/charsets/dos40/data.json").load(setup);

// If the window has been resized
window.onresize = function(event) {
  width = window.innerWidth;
  height = window.innerHeight;
  // Resize the app
  app.resize(width, height);
};

// When a chunk is sent to the client
socket.on("chunk-data", function(data) {
  console.log("Recived chunk: " + data.position.x + "," +  + data.position.y);

  // Create a container for the chunk and add it to the stage
  const chunk = new PIXI.Container();
  app.stage.addChild(chunk);

  // Put the chunk contain in the right location
  chunk.x = data.position.x * TILES_PER_CHUNK * tileSize;
  chunk.y = data.position.y * TILES_PER_CHUNK * tileSize;

  for(var i = 0; i < TILES_PER_CHUNK; i++) {
    for(var j = 0; j < TILES_PER_CHUNK; j++) {
      if(data.chunk.tiles[i * TILES_PER_CHUNK + j] != 0) {
        //Create the tile sprite from the texture
        var tile = new PIXI.Sprite(tileSet.textures["dos40-" + data.chunk.tiles[i * TILES_PER_CHUNK + j] + ".png"]);

        //Position the tile sprite in the chunk
        tile.x = i * tileSize;
        tile.y = j * tileSize;
        tile.height = tileSize;
        tile.width = tileSize;

        //Add the tile to the stage
        chunk.addChild(tile);
      }
    }
  }
});

function setup() {
  tileSet = PIXI.Loader.shared.resources["client/assets/charsets/dos40/data.json"].spritesheet;
  for(var i = 0; i < 256; i++) {
    // Set it to nearest scale
    tileSet.textures["dos40-" + i + ".png"].baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  }
  // Send a loaded message to the sever
  socket.emit("loaded");
}