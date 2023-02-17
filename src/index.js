const ModuleFactory = require("./wasm-zfp");
const ModulePromise = ModuleFactory();

/** @typedef { import(".").ZfpBuffer } ZfpBuffer */
/** @typedef { import(".").ZfpInput } ZfpInput */
/** @typedef { import(".").ZfpCompressOptions } ZfpCompressOptions */
/** @typedef { import(".").ZfpResult } ZfpResult */

let Module;

function ensureLoaded() {
  if (!Module) {
    throw new Error(
      `wasm-zfp has not finished loading. Please wait with "await decompress.isLoaded" before calling decompress`
    );
  }
}

/**
 * Allocate a scratch space buffer for encoding or decoding ZFP data.
 * @returns {ZfpBuffer} Opaque pointer for a ZfpBuffer.
 */
module.exports.createBuffer = function createBuffer() {
  ensureLoaded();
  return Module._createBuffer();
};

/**
 * Destroys the given buffer, freeing any memory associated with it.
 * @param {ZfpBuffer} zfpBuffer ZfpBuffer to free
 */
module.exports.freeBuffer = function freeBuffer(zfpBuffer) {
  ensureLoaded();
  Module._freeBuffer(zfpBuffer);
};

/**
 * Compress the data described in `zfpInput` including a full ZFP header.
 * @param {ZfpBuffer} zfpBuffer Scratch space buffer for compression
 * @param {ZfpInput} zfpInput Data to be compressed
 * @param {ZfpCompressOptions | undefined} opts Compression options. Default is lossless
 * @returns {Uint8Array} Compressed data
 */
module.exports.compress = function compress(zfpBuffer, zfpInput, opts) {
  ensureLoaded();
  opts = opts ?? {};
  const { data, shape, strides, dimensions } = zfpInput;
  while (shape.length < 4) {
    shape.push(0);
  }
  while (strides.length < 4) {
    strides.push(0);
  }
  const type = zfpType(data);
  const scalarCount = scalarCountForShape(shape, dimensions);
  const scalarSize = scalarSizeForType(type);
  const size = scalarCount * scalarSize;

  if (size === 0 || isNaN(size)) {
    throw new Error(`ZFP compression failed: cannot compress an empty array. scalarCount=${scalarCount}, scalarSize=${scalarSize}, size=${size}`);
  } else if (size > data.byteLength) {
    throw new Error(
      `ZFP compression failed: data buffer is too small. Expected ${size} bytes, got ${data.byteLength}`
    );
  } else if (size > Module.HEAPU8.byteLength) {
    throw new Error(
      `ZFP compression failed: Cannot allocate ${size} bytes (heap is ${Module.HEAPU8.byteLength})`
    );
  }

  const srcPointer = Module._malloc(size);

  // Create a view into the heap and copy the source buffer into it
  const srcHeap = new Uint8Array(Module.HEAPU8.buffer, srcPointer, size);
  srcHeap.set(new Uint8Array(data.buffer, data.byteOffset, size));

  // Create a ZfpBuffer struct on the heap describing the source data
  const inputBuffer = Module._createBuffer();
  Module.setValue(inputBuffer, srcPointer, "i32");
  Module.setValue(inputBuffer + 4, size, "i32");
  Module.setValue(inputBuffer + 8, size, "i32");
  Module.setValue(inputBuffer + 12, scalarSize, "i32");
  Module.setValue(inputBuffer + 16, shape[0], "i32");
  Module.setValue(inputBuffer + 20, shape[1], "i32");
  Module.setValue(inputBuffer + 24, shape[2], "i32");
  Module.setValue(inputBuffer + 28, shape[3], "i32");
  Module.setValue(inputBuffer + 32, strides[0], "i32");
  Module.setValue(inputBuffer + 36, strides[1], "i32");
  Module.setValue(inputBuffer + 40, strides[2], "i32");
  Module.setValue(inputBuffer + 44, strides[3], "i32");
  Module.setValue(inputBuffer + 48, dimensions, "i32");
  Module.setValue(inputBuffer + 52, type, "i32");

  try {
    // Call the C function to compress
    const tolerance = opts.tolerance ?? -1;
    const rate = opts.rate ?? -1;
    const precision = opts.precision ?? -1;
    const compressedSize = Module._compress(zfpBuffer, inputBuffer, tolerance, rate, precision);
    if (compressedSize <= 0) {
      throw new Error(`Error compressing ZFP data: ${compressedSize}`);
    }

    // Copy the compressed data into a new ArrayBuffer
    const outputPointer = Module.getValue(zfpBuffer, "i32");
    const output = new Uint8Array(Module.HEAPU8.buffer, outputPointer, compressedSize);
    const copy = new Uint8Array(output);

    return copy;
  } finally {
    // Free the source buffer memory
    Module._free(srcPointer);
    Module._freeBuffer(inputBuffer);
  }
}

/**
 * Decompress ZFP-compressed data (must start with a full ZFP header).
 * @param {ZfpBuffer} zfpBuffer Scratch space buffer for decompression
 * @param {Uint8Array} src ZFP-compressed byte array
 * @returns {ZfpResult} Results object containing a typed array and structure descriptors
 */
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

/**
 * A promise a consumer can listen to, to wait for the module to finish loading.
 * module loading is async and can take several hundred milliseconds. Accessing
 * the module before it is loaded will throw an error.
 * @type {Promise<void>}
 */
module.exports.isLoaded = ModulePromise.then((mod) =>
  mod["ready"].then(() => { })
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

function zfpType(data) {
  switch (data.constructor) {
    case Int32Array:
      return 1;
    case BigInt64Array:
      return 2;
    case Float32Array:
      return 3;
    case Float64Array:
      return 4;
    default:
      throw new Error(`Unsupported typed array type: ${data.constructor.name}`);
  }
}

function scalarCountForShape(shape, dimensions) {
  if (dimensions <= 0) {
    return 0;
  }

  let count = 1;
  for (let i = 0; i < dimensions; i++) {
    count *= shape[i];
  }
  return count;
}

function scalarSizeForType(type) {
  switch (type) {
    case 1: // int32
      return 4;
    case 2: // int64
      return 8;
    case 3: // float32
      return 4;
    case 4: // float64
      return 8;
    default:
      throw new Error(`Unknown zfp type: ${type}`);
  }
}
