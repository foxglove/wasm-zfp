const ModuleFactory = require("./wasm-zfp");
const ModulePromise = ModuleFactory();

let Module;

function ensureLoaded() {
  if (!Module) {
    throw new Error(
      `wasm-zfp has not finished loading. Please wait with "await decompress.isLoaded" before calling decompress`
    );
  }
}

module.exports.createBuffer = function createBuffer() {
  ensureLoaded();
  return Module._createBuffer();
};

module.exports.freeBuffer = function freeBuffer(zfpBuffer) {
  ensureLoaded();
  Module._freeBuffer(zfpBuffer);
};

module.exports.decompress = function decompress(zfpBuffer, src) {
  ensureLoaded();
  const srcSize = src.byteLength;
  const srcPointer = Module._malloc(srcSize);

  // Create a view into the heap and copy the source buffer into it
  const compressedHeap = new Uint8Array(
    Module.HEAPU8.buffer,
    srcPointer,
    srcSize
  );
  compressedHeap.set(src);

  // Call the C function to decompress
  const result = Module._decompress(zfpBuffer, srcPointer, srcSize);

  try {
    if (result !== 0) {
      throw new Error(`Error decompressing ZFP data: ${result}`);
    }

    // Copy fields from the C struct into a JS object
    const dataPointer = Module.getValue(zfpBuffer, "i32");
    const bufferSize = Module.getValue(zfpBuffer + 4, "i32");
    const size = Module.getValue(zfpBuffer + 8, "i32");
    const output = {
      data: new Uint8Array(size),
      dataPointer,
      bufferSize,
      size,
      scalarSize: Module.getValue(zfpBuffer + 12, "i32"),
      shape: [
        Module.getValue(zfpBuffer + 16, "i32"),
        Module.getValue(zfpBuffer + 20, "i32"),
        Module.getValue(zfpBuffer + 24, "i32"),
        Module.getValue(zfpBuffer + 28, "i32"),
      ],
      stride: [
        Module.getValue(zfpBuffer + 32, "i32"),
        Module.getValue(zfpBuffer + 36, "i32"),
        Module.getValue(zfpBuffer + 40, "i32"),
        Module.getValue(zfpBuffer + 44, "i32"),
      ],
      dimensions: Module.getValue(zfpBuffer + 48, "i32"),
      type: Module.getValue(zfpBuffer + 52, "i32"),
    };

    // Copy the decompressed data into `data`
    Buffer.from(Module.HEAPU8.buffer).copy(
      output.data,
      0,
      output.dataPointer,
      output.dataPointer + output.size
    );

    return output;
  } finally {
    // Free the source buffer memory
    Module._free(srcPointer);
  }
};

// export a promise a consumer can listen to to wait
// for the module to finish loading
// module loading is async and can take
// several hundred milliseconds...accessing the module
// before it is loaded will throw an error
module.exports.isLoaded = ModulePromise.then((mod) =>
  mod["ready"].then(() => {})
);

// Wait for the promise returned from ModuleFactory to resolve
ModulePromise.then((mod) => {
  Module = mod;

  // export the Module object for testing purposes _only_
  if (typeof process === "object" && process.env.NODE_ENV === "test") {
    module.exports.__module = Module;
  }
});
