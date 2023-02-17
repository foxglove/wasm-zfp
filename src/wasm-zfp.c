#include <emscripten/emscripten.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "zfp.h"

struct ZfpBuffer {
  char* dataPointer;
  size_t bufferSize;
  size_t size;
  size_t scalarSize;
  size_t shape[4];
  ptrdiff_t stride[4];
  uint32_t dimensions;
  uint32_t type;
};

int main(int argc, char** argv) {}

#ifdef __cplusplus
extern "C" {
#endif

struct ZfpBuffer* EMSCRIPTEN_KEEPALIVE createBuffer() {
  struct ZfpBuffer* buffer = malloc(sizeof(struct ZfpBuffer));
  memset(buffer, 0, sizeof(struct ZfpBuffer));
  return buffer;
}

void EMSCRIPTEN_KEEPALIVE freeBuffer(struct ZfpBuffer* buffer) {
  if (buffer != NULL) {
    if (buffer->dataPointer != NULL) {
      free(buffer->dataPointer);
    }
    free(buffer);
  }
}

int EMSCRIPTEN_KEEPALIVE compress(struct ZfpBuffer* output, struct ZfpBuffer* input,
                                  float tolerance, float rate, int precision) {
  if (input == NULL) {
    return -1;
  }
  if (output == NULL) {
    return -2;
  }
  if (input->dimensions < 1 || input->dimensions > 4) {
    return -3;
  }

  // Allocate the output buffer if needed
  if (output->dataPointer != NULL && output->bufferSize < input->size) {
    free(output->dataPointer);
    output->dataPointer = NULL;
  }
  if (output->dataPointer == NULL) {
    output->dataPointer = malloc(input->size);
    output->bufferSize = input->size;
  }

  // Open the output data stream
  bitstream* outputStream = stream_open(output->dataPointer, input->size);
  zfp_stream* zfp = zfp_stream_open(outputStream);

  // Set the compression parameters
  if (tolerance >= 0) {
    zfp_stream_set_accuracy(zfp, tolerance);
  } else if (rate >= 0) {
    zfp_stream_set_rate(zfp, rate, input->type, input->dimensions, 0);
  } else if (precision >= 0) {
    zfp_stream_set_precision(zfp, (uint)precision);
  } else {
    zfp_stream_set_reversible(zfp);
  }

  // Set the field definition (header parameters)
  zfp_field* field = zfp_field_alloc();
  zfp_field_set_pointer(field, input->dataPointer);
  zfp_field_set_type(field, input->type);
  switch (input->dimensions) {
    case 1:
      zfp_field_set_size_1d(field, input->shape[0]);
      zfp_field_set_stride_1d(field, input->stride[0]);
      break;
    case 2:
      zfp_field_set_size_2d(field, input->shape[0], input->shape[1]);
      zfp_field_set_stride_2d(field, input->stride[0], input->stride[1]);
      break;
    case 3:
      zfp_field_set_size_3d(field, input->shape[0], input->shape[1], input->shape[2]);
      zfp_field_set_stride_3d(field, input->stride[0], input->stride[1], input->stride[2]);
      break;
    case 4:
      zfp_field_set_size_4d(field, input->shape[0], input->shape[1], input->shape[2],
                            input->shape[3]);
      zfp_field_set_stride_4d(field, input->stride[0], input->stride[1], input->stride[2],
                              input->stride[3]);
      break;
  }

  // Write the header
  size_t bytesWritten = zfp_write_header(zfp, field, ZFP_HEADER_FULL);

  // Compress the data
  size_t compressedSize = zfp_compress(zfp, field);

  // Close the streams and free allocations
  zfp_field_free(field);
  zfp_stream_close(zfp);
  stream_close(outputStream);

  if (compressedSize == 0) {
    return -4;
  }

  return compressedSize;
}

int EMSCRIPTEN_KEEPALIVE decompress(struct ZfpBuffer* output, const char* srcData,
                                    size_t srcLength) {
  if (output == NULL) {
    return -1;
  }
  if (srcData == NULL) {
    return -2;
  }

  // Open the input data stream
  bitstream* inputStream = stream_open((void*)srcData, srcLength);
  zfp_stream* zfp = zfp_stream_open(inputStream);

  // Read the header
  zfp_field* field = zfp_field_alloc();
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
