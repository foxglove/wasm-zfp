# @foxglove/wasm-zfp

[![npm version](https://img.shields.io/npm/v/@foxglove/wasm-zfp)](https://www.npmjs.com/package/@foxglove/wasm-zfp)

ZFP decompression compiled to WebAssembly

## Introduction

This package provides a WebAssembly build of https://computing.llnl.gov/projects/zfp, the official ZFP library. A high-level decompression API is provided to decompress ZFP data with a prefixed `ZFP_HEADER_FULL` header.

## Usage

Create ZFP compressed data. An example is given in the `test/` directory generated with the following command:

```sh
# Take the 2x3x4 array of float32s in uncompressed.raw and compress it to compressed.zfp with a header
zfp -i uncompressed.raw -h -f -3 2 3 4 -a 1 -z compressed.zfp
```

Decompress the data (node.js example, browsers are also supported):

```ts
import { readFileSync } from "fs";
import Zfp from "@foxglove/wasm-zfp";

const compressed = readFileSync("compressed.zfp");

// Wait for the WebAssembly module to load
await Zfp.isLoaded;
// Create an internal allocation for decompression. This can be reused for
// multiple decompressions
const zfpBuffer = Zfp.createBuffer();

try {
  // Decompress the Uint8Array `compressed` and return an object containing
  // metadata about the type and shape of the array, as well as the decompressed
  // typed array
  const result = Zfp.decompress(zfpBuffer, compressed);
  console.log(result);
} catch (error) {
  console.error(error);
}

// Free the internal allocation when it is no longer needed
Zfp.freeBuffer(zfpBuffer);
```

For the `test/compressed.zfp` file in this repository, the output is:

```js
{
  data: Float32Array(24) [
     0,  1,  2,  3,  4,  5,  6,  7,
     8,  9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22, 23
  ],
  dataPointer: 1052800,
  bufferSize: 96,
  size: 96,
  scalarSize: 4,
  shape: [ 2, 3, 4, 0 ],
  stride: [ 1, 2, 6, 0 ],
  dimensions: 3,
  type: 3
}
```

The `dataPointer` field is an opaque pointer. The remaining fields come from the
ZFP header and decompressed data.

## Development

Docker is required to build the WebAssembly module.

1. `yarn install`
2. `yarn build`
3. `yarn test`

## License

@foxglove/wasm-zfp is licensed under [MIT License](https://opensource.org/licenses/MIT).

## Releasing

1. Run `yarn version --[major|minor|patch]` to bump version
2. Run `git push && git push --tags` to push new tag
3. GitHub Actions will take care of the rest

## Stay in touch

Join our [Slack channel](https://foxglove.dev/join-slack) to ask questions, share feedback, and stay up to date on what our team is working on.
