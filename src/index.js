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
    const scalarSize = Module.getValue(zfpBuffer + 12, "i32");
    const elements = size / scalarSize;
    const type = Module.getValue(zfpBuffer + 52, "i32");
    const data = typedArray(type, elements);
    const output = {
      data,
      dataPointer,
      bufferSize,
      size,
      scalarSize,
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
      type,
    };

    // Copy the decompressed data into the ArrayBuffer backing `data`
    const outputBytes = new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
    outputBytes.set(new Uint8Array(Module.HEAPU8.buffer, dataPointer, size));

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

function typedArray(type, elements) {
  switch (type) {
    case 1:
      return new Int32Array(elements);
    case 2:
      return new BigInt64Array(elements);
    case 3:
      return new Float32Array(elements);
    case 4:
      return new Float64Array(elements);
    default:
      throw new Error(`Unknown zfp_type: ${type}`);
  }
}
