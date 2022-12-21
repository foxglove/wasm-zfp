process.env.NODE_ENV = "test";

const fs = require("fs");
const assert = require("assert");

const Zfp = require("../");

// uncompressed.raw is a 2x3x4 array of float32s
const uncompressed = fs.readFileSync(__dirname + "/uncompressed.raw");
// compressed.zfp was created with `zfp -i uncompressed.raw -h -f -3 2 3 4 -a 1 -z compressed.zfp`
const compressed = fs.readFileSync(__dirname + "/compressed.zfp");

// NOTE: we cannot put this within a mocha test because wasm compiles faster
// than mocha starts the first test
assert.throws(() => {
  Zfp.createBuffer();
});

describe("wasm-zfp", () => {
  it("waits until module is ready", (done) => {
    Zfp.isLoaded.then(done);
  });

  it("decompresses accurately", () => {
    const zfpBuffer = Zfp.createBuffer();

    const result = Zfp.decompress(zfpBuffer, compressed);
    assert(result.dataPointer !== 0);
    assert(result.bufferSize === uncompressed.byteLength);
    assert(result.size === uncompressed.byteLength);
    assert(result.data.byteLength === uncompressed.byteLength);
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
        result.data[i] === uncompressed[i],
        `${i}: ${result.data[i]} !== ${uncompressed[i]}`
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
