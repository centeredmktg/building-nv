import OnboardingFlow from "./OnboardingFlow";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/onboarding/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json();
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md w-full px-6 text-center">
          <p className="text-gray-900 font-semibold text-lg mb-2">This link is no longer valid</p>
          <p className="text-gray-500 text-sm">{data.error}</p>
        </div>
      </div>
    );
  }

  const { employee } = await res.json();

  const completedSteps = employee?.onboardingSteps
    ?.filter((s: { completedAt: string | null }) => s.completedAt)
    ?.map((s: { stepName: string }) => s.stepName) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="font-bold text-xl text-gray-900">Building NV</p>
          <p className="text-gray-500 text-sm mt-1">New Employee Onboarding</p>
        </div>
        <OnboardingFlow
          token={token}
          employeeId={employee?.id ?? null}
          completedSteps={completedSteps}
          employmentType={employee?.employmentType ?? null}
        />
      </div>
    </div>
  );
}
