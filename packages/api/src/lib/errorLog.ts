export default function errorLog(error: Error | any) {
  console.error("--- An Error Occurred ---");
  console.error("Error Name:", error?.name);
  console.error("Error Message:", error?.message);

  // Log Node.js specific error code if present
  // @ts-ignore
  if (error?.code) {
    // @ts-ignore
    console.error("Error Code (Node.js):", error?.code);
  }

  console.error("Stack Trace:", error?.stack); // Most crucial for debugging!

  console.error("--- End Error Report ---");
}
