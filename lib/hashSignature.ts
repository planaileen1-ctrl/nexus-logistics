export async function generateSHA256Hash(data: string) {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(data)

  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return hashHex
}
