declare module 'spark-md5' {
  interface SparkMD5ArrayBuffer {
    append(arr: ArrayBuffer): SparkMD5ArrayBuffer
    end(raw?: boolean): string
    destroy(): void
    reset(): SparkMD5ArrayBuffer
  }
  interface SparkMD5Constructor {
    ArrayBuffer: new () => SparkMD5ArrayBuffer
  }
  const SparkMD5: SparkMD5Constructor
  export default SparkMD5
}
