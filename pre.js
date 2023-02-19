// This file is injected into the emscripten generated js file and overrides the
// Module.locateFile function to resolve the wasm file relative to the module
// for node and browser bundlers such as webpack

var nodePath;

if (typeof process !== "undefined") {
  Module["ENVIRONMENT"] = process.env.WASM_ZFP_ENVIRONMENT;
}

// In node, use __dirname to resolve the path to the wasm file. In the browser,
// use require to resolve the path to the wasm file. Without this, the wasm file
// is resolved relative to process.cwd or not bundled
Module.locateFile = function (input) {
  if (ENVIRONMENT_IS_NODE) {
    // Don't let emscripten js resolve the file to a relative path
    nodePath = {
      normalize: function (any) {
        return any;
      },
    };
    return __dirname + "/" + input;
  } else if (input.endsWith(".wasm")) {
    const wasmPath = require("./wasm-zfp.wasm");
    return wasmPath;
  } else {
    return input;
  }
};
