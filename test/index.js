process.env.NODE_ENV = "test";

const fs = require("fs");
const assert = require("assert");

/** @type { import("..").Zfp } */
const Zfp = require("../");

// uncompressed.raw is a 2x3x4 array of float32s
const uncompressed = fs.readFileSync(__dirname + "/uncompressed.raw");
// uncompressedi64.raw is an array of 10 int64s
const uncompressedi64 = fs.readFileSync(__dirname + "/uncompressedi64.raw");
// compressed.zfp was created with `zfp -i uncompressed.raw -h -f -3 2 3 4 -a 1 -z compressed.zfp`
const compressed = fs.readFileSync(__dirname + "/compressed.zfp");
// compressedi64.zfp was created with `zfp -i uncompressedi64.raw -h -t i64 -1 10 -R -z compressedi64.zfp`
const compressedi64 = fs.readFileSync(__dirname + "/compressedi64.zfp");
const float32s = new Float32Array(
  uncompressed.buffer,
  uncompressed.byteOffset,
  uncompressed.byteLength / 4
);
const int64s = new BigInt64Array(
  uncompressedi64.buffer,
  uncompressedi64.byteOffset,
  uncompressedi64.byteLength / 8
);

// NOTE: we cannot put this within a mocha test because wasm compiles faster
// than mocha starts the first test
assert.throws(() => {
  Zfp.createBuffer();
});

describe("decompression", () => {
  it("waits until module is ready", (done) => {
    Zfp.isLoaded.then(done);
  });

  it("decompresses vec3f", () => {
    const zfpBuffer = Zfp.createBuffer();

    const result = Zfp.decompress(zfpBuffer, compressed);
    assert(result.dataPointer !== 0);
    assert(result.bufferSize === float32s.byteLength);
    assert(result.size === float32s.byteLength);
    assert(result.data.byteLength === float32s.byteLength);
    assert(result.scalarSize === 4);
    assert(result.shape[0] === 2);
    assert(result.shape[1] === 3);
    assert(result.shape[2] === 4);
    assert(result.shape[3] === 0);
    assert(result.stride[0] === 1);
    assert(result.stride[1] === 2);
    assert(result.stride[2] === 6);
    assert(result.stride[3] === 0);
    assert(result.dimensions === 3);
    assert(result.type === 3);
    for (var i = 0; i < result.data.byteLength; i++) {
      assert(
        result.data[i] === float32s[i],
        `${i}: ${result.data[i]} !== ${float32s[i]}`
      );
    }

    Zfp.freeBuffer(zfpBuffer);
  });

  it("decompresses vec3i64", () => {
    const zfpBuffer = Zfp.createBuffer();

    const result = Zfp.decompress(zfpBuffer, compressedi64);
    assert(result.dataPointer !== 0);
    assert(result.bufferSize === int64s.byteLength);
    assert(result.size === int64s.byteLength);
    assert(result.data.byteLength === int64s.byteLength);
    assert(result.scalarSize === 8);
    assert(result.shape[0] === 10);
    assert(result.shape[1] === 0);
    assert(result.shape[2] === 0);
    assert(result.shape[3] === 0);
    assert(result.stride[0] === 1);
    assert(result.stride[1] === 0);
    assert(result.stride[2] === 0);
    assert(result.stride[3] === 0);
    assert(result.dimensions === 1);
    assert(result.type === 2);
    for (var i = 0; i < result.data.byteLength; i++) {
      assert(
        result.data[i] === int64s[i],
        `${i}: ${result.data[i]} !== ${int64s[i]}`
      );
    }

    Zfp.freeBuffer(zfpBuffer);
  });

  it("does not grow the heap after multiple decompression calls", () => {
    const zfpBuffer = Zfp.createBuffer();
    const originalHeapSize = Zfp.__module.HEAP8.buffer.byteLength;

    for (var i = 0; i < 50000; i++) {
      Zfp.decompress(zfpBuffer, compressed);
    }

    const newHeapSize = Zfp.__module.HEAP8.buffer.byteLength;
    assert(originalHeapSize === newHeapSize);

    Zfp.freeBuffer(zfpBuffer);
  });

  it("throws an error if decompressing invalid buffer", () => {
    const zfpBuffer = Zfp.createBuffer();

    assert.throws(() => {
      Zfp.decompress(
        zfpBuffer,
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      );
    });

    Zfp.freeBuffer(zfpBuffer);
  });
});

describe("compression", () => {
  it("compresses vec3f", () => {
    const zfpBuffer = Zfp.createBuffer();
    // `zfp -i uncompressed.raw -h -f -3 2 3 4 -a 1 -z compressed.zfp`
    const zfpInput = {
      data: float32s,
      shape: [2, 3, 4, 0],
      strides: [1, 2, 6, 0],
      dimensions: 3,
    };
    const output = Zfp.compress(zfpBuffer, zfpInput, { tolerance: 1 });

    // Compare byte-for-byte with `compressed`
    assert(output.byteLength === compressed.byteLength)
    for (var i = 0; i < output.byteLength; i++) {
      assert(
        output[i] === compressed[i],
        `${i}: ${output[i]} !== ${compressed[i]}`
      );
    }

    Zfp.freeBuffer(zfpBuffer);
  });

  it("compresses vec3i64", () => {
    const zfpBuffer = Zfp.createBuffer();
    // `zfp -i uncompressedi64.raw -h -t i64 -1 10 -R -z compressedi64.zfp`
    const zfpInput = {
      data: int64s,
      shape: [10, 0, 0, 0],
      strides: [1, 0, 0, 0],
      dimensions: 1,
    };
    const output = Zfp.compress(zfpBuffer, zfpInput);

    // Compare byte-for-byte with `compressedi64`
    assert(output.byteLength === compressedi64.byteLength)
    for (var i = 0; i < output.byteLength; i++) {
      assert(
        output[i] === compressedi64[i],
        `${i}: ${output[i]} !== ${compressedi64[i]}`
      );
    }

    Zfp.freeBuffer(zfpBuffer);
  });

  it("does not grow the heap after multiple compression calls", () => {
    const zfpBuffer = Zfp.createBuffer();
    const zfpInput = {
      data: float32s,
      shape: [2, 3, 4],
      strides: [1, 2, 6],
      dimensions: 3,
    };
    Zfp.compress(zfpBuffer, zfpInput);
    const originalHeapSize = Zfp.__module.HEAP8.buffer.byteLength;

    for (var i = 0; i < 50000; i++) {
      Zfp.compress(zfpBuffer, zfpInput);
    }

    const newHeapSize = Zfp.__module.HEAP8.buffer.byteLength;
    assert(originalHeapSize === newHeapSize, `${originalHeapSize} !== ${newHeapSize}`);

    Zfp.freeBuffer(zfpBuffer);
  });

  it("throws an error if compressing invalid buffer", () => {
    const zfpBuffer = Zfp.createBuffer();
    const zfpInput = {
      data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      shape: [2, 3, 4],
      strides: [1, 2, 6],
      dimensions: 3,
    };

    assert.throws(() => {
      Zfp.compress(zfpBuffer, zfpInput);
    });

    Zfp.freeBuffer(zfpBuffer);
  });
});
