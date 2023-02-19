declare module "wasm-zfp" {
  export const ZfpType: {
    INT32: 1;
    INT64: 2;
    FLOAT: 3;
    DOUBLE: 4;
  };

  export type ZfpBuffer = number;

  export type ZfpInput = {
    data: Int32Array | BigInt64Array | Float32Array | Float64Array;
    shape: [number, number, number, number];
    strides: [number, number, number, number];
    dimensions: number;
  };

  export type ZfpCompressOptions = {
    tolerance?: number;
    rate?: number;
    precision?: number;
  };

  export type ZfpResult = {
    data: Int32Array | BigInt64Array | Float32Array | Float64Array;
    dataPointer: number;
    bufferSize: number;
    size: number;
    scalarSize: number;
    shape: [number, number, number, number];
    strides: [number, number, number, number];
    dimensions: number;
    type: 1 | 2 | 3 | 4;
  };

  type Zfp = {
    isLoaded: Promise<void>;
    createBuffer: () => number;
    freeBuffer: (zfpBuffer: number) => void;
    compress: (zfpBuffer: number, input: ZfpInput, options?: ZfpCompressOptions) => ZfpResult;
    decompress: (zfpBuffer: number, src: Uint8Array) => ZfpResult;
  };

  const zfp: Zfp;
  export default zfp;
}
