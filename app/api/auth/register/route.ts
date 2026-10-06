import { apiErrorResponse } from "@/lib/api-error";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

/** Accept only HTTPS URLs from UploadThing / UFS CDNs (not arbitrary user-supplied hosts). */
function isUploadThingHttpsUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "utfs.io" ||
      h.endsWith(".utfs.io") ||
      h === "ufs.sh" ||
      h.endsWith(".ufs.sh") ||
      h.endsWith(".uploadthing.com") ||
      h.endsWith(".uploadthing.pro")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // The app now sends JSON (strings + pre-uploaded media URLs); older builds
    // send multipart/form-data with file parts. Accept either.
    const contentType = request.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    let formData: FormData | null = null;
    let json: Record<string, unknown> = {};
    if (isJson) {
      json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    } else {
      formData = await request.formData();
    }
    const field = (name: string): string => {
      const v = isJson ? json[name] : formData?.get(name);
      return typeof v === "string" ? v.trim() : "";
    };

    const fullName = field("fullName");
    const email = field("email").toLowerCase();
    const phone = field("phone");
    const panNumber = field("panNumber").toUpperCase();
    const aadhaarNumber = field("aadhaarNumber");
    const accountNo = field("accountNo");
    const ifscCode = field("ifscCode").toUpperCase();
    const documentType = field("documentType");

    const photo = formData?.get("photo") ?? null;
    const bankProof = formData?.get("bankProof") ?? null;
    const document = formData?.get("document") ?? null;
    const signatureUrlRaw = field("signatureUrl");
    const documentUrlRaw = field("documentUrl");
    const documentName = field("documentName");

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { message: "Full name, email and phone are required" },
        { status: 400 },
      );
    }

    if (!accountNo || !ifscCode) {
      return NextResponse.json(
        { message: "Account details are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 400 },
      );
    }

    const documents: Record<
      string,
      { data: Buffer; contentType: string } | null
    > = {
      photo: null,
      signature: null,
      bankProof: null,
      document: null,
    };

    async function fileToDoc(
      fileEntry: FormDataEntryValue | null,
    ): Promise<{ data: Buffer; contentType: string } | null> {
      if (!fileEntry || !(fileEntry instanceof File)) return null;
      const arrayBuffer = await fileEntry.arrayBuffer();
      return {
        data: Buffer.from(arrayBuffer),
        contentType: fileEntry.type || "application/octet-stream",
      };
    }

    documents.photo = await fileToDoc(photo);
    documents.signature = await fileToDoc(formData?.get("signature") ?? null);
    documents.bankProof = await fileToDoc(bankProof);
    documents.document = await fileToDoc(document);

    // Signature & supporting document are OPTIONAL. Pre-uploaded UploadThing
    // URLs are stored when valid; an absent or invalid URL is simply stored as
    // null and NEVER blocks the request — the account request always goes
    // through as long as the core identity + bank fields are present.
    const signatureUploadThingUrl = isUploadThingHttpsUrl(signatureUrlRaw)
      ? signatureUrlRaw
      : null;
    const documentUrl = isUploadThingHttpsUrl(documentUrlRaw)
      ? documentUrlRaw
      : null;

    await users.insertOne({
      fullName,
      email,
      phone,
      panNumber: panNumber || null,
      aadhaarNumber: aadhaarNumber || null,
      bankDetails: {
        accountNo,
        ifscCode,
        documentType,
      },
      status: "pending",
      createdAt: new Date(),
      passwordHash: null,
      tradingBalance: 0,
      margin: 0,
      documents: {
        photo: documents.photo,
        signature: documents.signature,
        bankProof: documents.bankProof,
        document: documents.document,
        signatureUploadThingUrl,
        documentUrl,
        documentName: documentName || null,
      },
    });

    return NextResponse.json(
      {
        message: "Account request received successfully. Our team will reach out within 24 hours.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Registration error:",
      "Something went wrong while registering",
    );
  }
}
