import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Uploaded invoice files, stored by their SHA-256 fingerprint. A file can back one
// invoice number only: the same file offered again under a different number is
// refused, which catches a reused document even when the invoice number is changed.
// This check is kept by the Tavryn server, not by the ledger.

export const MAX_DOCUMENT_BYTES = 1_000_000;

const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export interface StoredDocument {
  sha256: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  invoiceNumber?: string;
}

interface Index {
  bySha: Record<string, StoredDocument>;
  byInvoice: Record<string, string>;
}

export class DocumentError extends Error {
  constructor(
    message: string,
    readonly publicCode: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

export class DocumentStore {
  private index: Index;
  private readonly indexPath: string;

  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    this.indexPath = join(dir, "index.json");
    this.index = existsSync(this.indexPath)
      ? (JSON.parse(readFileSync(this.indexPath, "utf8")) as Index)
      : { bySha: {}, byInvoice: {} };
  }

  static fromEnvironment(): DocumentStore | undefined {
    const dir = process.env.TAVRYN_DOCUMENTS_DIR?.trim();
    return dir ? new DocumentStore(dir) : undefined;
  }

  upload(body: Buffer, name: string, type: string): StoredDocument & { duplicateOf?: string } {
    const extension = TYPES[type];
    if (!extension) {
      throw new DocumentError("Upload a PDF, PNG or JPEG file.", "DOCUMENT_TYPE_UNSUPPORTED");
    }
    if (body.length === 0 || body.length > MAX_DOCUMENT_BYTES) {
      throw new DocumentError("The file must be under 1 MB.", "DOCUMENT_TOO_LARGE");
    }
    const sha256 = createHash("sha256").update(body).digest("hex");
    const existing = this.index.bySha[sha256];
    if (existing) {
      return { ...existing, ...(existing.invoiceNumber ? { duplicateOf: existing.invoiceNumber } : {}) };
    }
    writeFileSync(join(this.dir, `${sha256}.${extension}`), body);
    const stored: StoredDocument = {
      sha256,
      name: name.slice(0, 200) || `invoice.${extension}`,
      type,
      size: body.length,
      uploadedAt: new Date().toISOString(),
    };
    this.index.bySha[sha256] = stored;
    this.save();
    return stored;
  }

  // Run before the invoice is created on the ledger, so a reused file is refused
  // without leaving a draft behind.
  assertLinkable(sha256: string, invoiceNumber: string): void {
    const stored = this.index.bySha[sha256];
    if (!stored) {
      throw new DocumentError("That file was not uploaded. Upload it again.", "DOCUMENT_NOT_FOUND", 404);
    }
    if (stored.invoiceNumber && stored.invoiceNumber !== invoiceNumber) {
      throw new DocumentError(
        `This exact file was already submitted as invoice ${stored.invoiceNumber}.`,
        "DUPLICATE_DOCUMENT",
        409,
        { duplicateOf: stored.invoiceNumber },
      );
    }
    const linked = this.index.byInvoice[invoiceNumber];
    if (linked && linked !== sha256) {
      throw new DocumentError(
        `Invoice ${invoiceNumber} already has a different file attached.`,
        "INVOICE_HAS_DOCUMENT",
        409,
      );
    }
  }

  link(sha256: string, invoiceNumber: string): void {
    this.assertLinkable(sha256, invoiceNumber);
    this.index.bySha[sha256].invoiceNumber = invoiceNumber;
    this.index.byInvoice[invoiceNumber] = sha256;
    this.save();
  }

  forInvoice(invoiceNumber: string): { meta: StoredDocument; body: Buffer } | undefined {
    const sha256 = this.index.byInvoice[invoiceNumber];
    const meta = sha256 ? this.index.bySha[sha256] : undefined;
    if (!meta) return undefined;
    return { meta, body: readFileSync(join(this.dir, `${sha256}.${TYPES[meta.type]}`)) };
  }

  invoicesWithDocuments(): string[] {
    return Object.keys(this.index.byInvoice);
  }

  private save(): void {
    const temporary = `${this.indexPath}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.index));
    renameSync(temporary, this.indexPath);
  }
}
