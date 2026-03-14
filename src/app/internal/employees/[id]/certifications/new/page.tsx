import CertUploadForm from "./CertUploadForm";

export default async function NewCertificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">Add Certification</h1>
      <CertUploadForm employeeId={id} />
    </div>
  );
}
