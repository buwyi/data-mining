import SparkMD5 from 'spark-md5'

const CHUNK = 2 * 1024 * 1024

/** 计算整文件 MD5 十六进制字符串，与旧版 WebUploader.md5File 用途一致 */
export async function computeFileMd5Hex(file: File): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer()
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size)
    const buf = await file.slice(offset, end).arrayBuffer()
    spark.append(buf)
    offset = end
  }
  return spark.end()
}
