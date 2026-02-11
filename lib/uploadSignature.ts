import { ref, uploadString, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"

export async function uploadSignatureToStorage(
  orderId: string,
  base64: string
) {
  const signatureRef = ref(
    storage,
    `signatures/${orderId}.png`
  )

  await uploadString(signatureRef, base64, "data_url")

  const downloadURL = await getDownloadURL(signatureRef)

  return downloadURL
}
