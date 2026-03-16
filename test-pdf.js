const pdfParse = require('pdf-parse');
const fs = require('fs');

async function test() {
  try {
    // Try a real PDF if available, or test with fake data
    const testBuffer = Buffer.from('%PDF-1.4\n%test\nstream\nHello World\nendstream');
    const data = await pdfParse(testBuffer);
    console.log('Extracted text:', JSON.stringify(data.text));
    console.log('Version:', data.version);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
