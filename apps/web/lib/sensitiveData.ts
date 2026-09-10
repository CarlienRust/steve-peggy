const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/;
const MRN = /\b(?:MRN|medical record|patient id|hospital number)[:\s#]*[\w-]{4,}\b/i;
const NAME_PHRASE = /\b(?:patient name|mr\.|mrs\.|ms\.|dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/;

export type PhiFlag = "email" | "phone" | "medical_record_id" | "person_name";

export function detectPhiFlags(text: string): PhiFlag[] {
  if (!text.trim()) return [];
  const flags: PhiFlag[] = [];
  if (EMAIL.test(text)) flags.push("email");
  if (PHONE.test(text)) flags.push("phone");
  if (MRN.test(text)) flags.push("medical_record_id");
  if (NAME_PHRASE.test(text)) flags.push("person_name");
  return flags;
}

export function phiWarningMessage(flags: PhiFlag[]): string {
  if (flags.length === 0) return "";
  return (
    `This text may contain identifiable information (${flags.join(", ")}). ` +
    "Use general descriptions only. Confirm you have ethics/IRB permission before uploading sensitive data."
  );
}

export function blocksLlmGuidance(identifierLevel?: string): boolean {
  return identifierLevel === "identifiable";
}
