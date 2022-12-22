export const enum ZfpType {
  None = 0,
  Int32 = 1,
  Int64 = 2,
  Float = 3,
  Double = 4,
}

export type ZfpResult = {
  data: Int32Array | BigInt64Array | Float32Array | Float64Array;
  dataPointer: number;
  bufferSize: number;
  size: number;
  scalarSize: number;
  shape: [number, number, number, number];
  strides: [number, number, number, number];
  dimensions: number;
  type: ZfpType;
};

export type Zfp = {
  isLoaded: Promise<void>;
  createBuffer: () => number;
  freeBuffer: (zfpBuffer: number) => void;
  decompress: (zfpBuffer: number, src: Uint8Array) => ZfpResult;
};

export default Zfp;
