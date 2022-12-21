#include "zfp.h"
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct ZfpBuffer {
  char *dataPointer;
  size_t bufferSize;
  size_t size;
  size_t scalarSize;
  size_t shape[4];
  ptrdiff_t stride[4];
  uint32_t dimensions;
  uint32_t type;
};

int main(int argc, char **argv) {}

#ifdef __cplusplus
extern "C" {
#endif

struct ZfpBuffer *EMSCRIPTEN_KEEPALIVE createBuffer() {
  struct ZfpBuffer *buffer = malloc(sizeof(struct ZfpBuffer));
  memset(buffer, 0, sizeof(struct ZfpBuffer));
  return buffer;
}

void EMSCRIPTEN_KEEPALIVE freeBuffer(struct ZfpBuffer *buffer) {
  if (buffer != NULL) {
    if (buffer->dataPointer != NULL) {
      free(buffer->dataPointer);
    }
    free(buffer);
  }
}

int EMSCRIPTEN_KEEPALIVE decompress(struct ZfpBuffer *output,
                                    const char *srcData, size_t srcLength) {
  if (output == NULL) {
    return -1;
  }
  if (srcData == NULL) {
    return -2;
  }

  // Open the input data stream
  bitstream *inputStream = stream_open((void *)srcData, srcLength);
  zfp_stream *zfp = zfp_stream_open(inputStream);

  // Read the header
  zfp_field *field = zfp_field_alloc();
  size_t bytesRead = zfp_read_header(zfp, field, ZFP_HEADER_FULL);
  if (bytesRead == 0) {
    return -3;
  }

  // Get the field parameters
  size_t scalarCount = zfp_field_size(field, output->shape);
  output->type = zfp_field_type(field);
  output->dimensions = zfp_field_dimensionality(field);
  output->scalarSize = zfp_field_precision(field) / 8;
  output->size = scalarCount * output->scalarSize;
  zfp_field_stride(field, output->stride);

  // If the output buffer is not large enough, deallocate it (if it exists)
  if (output->bufferSize < output->size) {
    free(output->dataPointer);
    output->dataPointer = NULL;
  }

  // Allocate the output buffer if needed
  if (output->dataPointer == NULL) {
    output->dataPointer = malloc(output->size);
    output->bufferSize = output->size;
  }

  // Decompress the data
  zfp_field_set_pointer(field, output->dataPointer);
  size_t result = zfp_decompress(zfp, field);
  if (result == 0) {
    return -4;
  }

  // Close the streams and free allocations
  zfp_field_free(field);
  zfp_stream_close(zfp);
  stream_close(inputStream);

  return 0;
}

#ifdef __cplusplus
}
#endif
