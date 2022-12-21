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

## Development

Docker is required to build the WebAssembly module.

1. `yarn install`
2. `yarn build`
3. `yarn test`

## Stay in touch

Join our [Slack channel](https://foxglove.dev/join-slack) to ask questions, share feedback, and stay up to date on what our team is working on.
