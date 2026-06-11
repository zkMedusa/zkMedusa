/** bb.js 5 compressed CRS must be a multiple of 4_194_304 bytes (32 B × 2^17 points). */
export const MIN_COMPRESSED_CRS_POINTS = 2 ** 17;

export function computeSrsSize(dyadicSize: number): number {
  const required = Math.max(dyadicSize, MIN_COMPRESSED_CRS_POINTS);
  return Math.ceil(required / MIN_COMPRESSED_CRS_POINTS) * MIN_COMPRESSED_CRS_POINTS;
}

export function isCrsBufferError(message: string): boolean {
  return (
    message.includes("invalid points_buf size") ||
    message.includes("compressed points_buf size") ||
    message.includes("positive multiple of")
  );
}
