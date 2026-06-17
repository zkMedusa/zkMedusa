const STEPS = [
  { id: 1, label: "Connect" },
  { id: 2, label: "Verify" },
  { id: 3, label: "Prove" },
  { id: 4, label: "Mint" },
  { id: 5, label: "Done" },
] as const;

export interface StepDefinition {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps?: readonly StepDefinition[];
}

export default function StepIndicator({
  currentStep,
  steps = STEPS,
}: StepIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1 md:gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = currentStep > stepNumber;
          const isActive = currentStep === stepNumber;

          return (
            <div key={step.id} className="flex flex-1 items-center min-w-0">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <div
                  className={[
                    "flex h-8 w-8 md:h-10 md:w-10 items-center justify-center border text-xs md:text-sm font-['PerfectDOS'] shrink-0 transition-colors",
                    isComplete
                      ? "border-white bg-white text-black"
                      : isActive
                        ? "border-white bg-white/10 text-white"
                        : "border-white/25 text-white/40",
                  ].join(" ")}
                >
                  {isComplete ? "✓" : stepNumber}
                </div>
                <span
                  className={[
                    "font-['PerfectDOS'] text-[10px] md:text-xs uppercase text-center truncate w-full",
                    isActive ? "text-white" : "text-white/40",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={[
                    "h-px flex-1 min-w-[8px] mb-6 transition-colors",
                    currentStep > stepNumber ? "bg-white" : "bg-white/20",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { STEPS };
