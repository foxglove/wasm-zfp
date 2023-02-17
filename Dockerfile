FROM emscripten/emsdk:3.1.28

# Clone the ZFP repository at a specific tag
RUN mkdir -p /zfp && \
  cd /zfp && \
  git init && \
  git remote add origin https://github.com/LLNL/zfp.git && \
  git fetch --depth 1 origin release1.0.0 && \
  git checkout FETCH_HEAD

# Build the library
RUN mkdir -p /zfp/build && \
  cd /zfp/build && \
  emcmake cmake \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_FLAGS_RELEASE="-O3" \
  -DBUILD_ZFORP=OFF \
  -DBUILD_ZFPY=OFF \
  -DBUILD_UTILITIES=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DBUILD_TESTING=OFF \
  .. && \
  emmake make

WORKDIR /wasm-zfp
COPY build.sh pre.js /wasm-zfp/
COPY src /wasm-zfp/src
