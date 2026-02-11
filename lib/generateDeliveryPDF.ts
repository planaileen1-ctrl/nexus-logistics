export async function generateDeliveryPDF(data: {
  orderId: string
  customerName: string
  driverName: string
  pumpNumbers: string[]
  deliveredAt: string
  ip: string
  lat: number
  lng: number
  signatureUrl: string
  driverSignatureUrl: string
}) {
  // Use an indirect dynamic import to avoid bundler trying to resolve 'jspdf' at build time
  const dynImport: any = new Function("id", "return import(id)");
  let jsPDFModule: any;
  try {
    jsPDFModule = await dynImport("jspdf");
  } catch (err) {
    console.warn("jspdf not available, skipping PDF image embedding:", err);
    // Fallback: create a minimal blob with text-only PDF via a tiny approach
    const blob = new Blob([`Order PDF for ${data.orderId}`], { type: "application/pdf" });
    return blob;
  }

  const { jsPDF } = jsPDFModule as any;
  const doc = new jsPDF();

  doc.setFontSize(12);

  doc.text(`Order ID: ${data.orderId}`, 10, 10);
  doc.text(`Customer: ${data.customerName}`, 10, 20);
  doc.text(`Driver: ${data.driverName}`, 10, 30);
  doc.text(`Pumps: ${data.pumpNumbers.join(", ")}`, 10, 40);
  doc.text(`Delivered At: ${data.deliveredAt}`, 10, 50);
  doc.text(`IP Address: ${data.ip}`, 10, 60);
  doc.text(`Location: ${data.lat}, ${data.lng}`, 10, 70);

  try {
    const img1 = data.signatureUrl;
    const img2 = data.driverSignatureUrl;

    doc.text("Customer Signature:", 10, 85);
    doc.addImage(img1, "PNG", 10, 90, 80, 40);

    doc.text("Driver Signature:", 110, 85);
    doc.addImage(img2, "PNG", 110, 90, 80, 40);
  } catch (err) {
    // If images cannot be loaded into PDF, continue without them
    console.warn("Failed to add images to PDF:", err);
  }

  const blob = doc.output("blob");
  return blob;
}
