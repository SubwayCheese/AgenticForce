// Full-document text extraction for /summarize. Deliberately separate from lib/pinned-context.js:
// that module's caps (4000 chars/doc, 12000 total) are sized for small multi-doc reference
// snippets shared across a prompt budget -- wrong shape for one large meeting transcript, which
// needs (close to) its full length. Same underlying pdf-parse/mammoth calls, different budget.

const PER_DOC_CHAR_CAP = 60_000; // ~15k tokens -- covers the large majority of real single-meeting
                                  // transcripts while keeping prompt size/latency predictable.
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx']);

async function extractTranscript(buffer, ext, charCap = PER_DOC_CHAR_CAP) {
  let raw;
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    raw = (await pdfParse(buffer)).text;
  } else if (ext === '.docx') {
    const mammoth = require('mammoth');
    raw = (await mammoth.extractRawText({ buffer })).value;
  } else {
    throw new Error(`Unsupported file type ${ext || '(none)'}`);
  }

  const trimmed = (raw || '').trim();
  const truncated = trimmed.length > charCap;
  return {
    text: truncated ? trimmed.slice(0, charCap) : trimmed,
    truncated,
    charCap,
    originalLength: trimmed.length,
  };
}

module.exports = { extractTranscript, SUPPORTED_EXTENSIONS, PER_DOC_CHAR_CAP };
