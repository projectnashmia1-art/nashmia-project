export function validatePasswordRules(password: string) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const passedCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;

  let strengthLabel = "Too weak";
  let strengthPercent = 0;
  let strengthColor = "bg-slate-200";

  if (password.length > 0) {
    if (passedCount === 1) {
      strengthLabel = "Weak";
      strengthPercent = 25;
      strengthColor = "bg-rose-400";
    } else if (passedCount === 2) {
      strengthLabel = "Fair";
      strengthPercent = 50;
      strengthColor = "bg-amber-400";
    } else if (passedCount === 3) {
      strengthLabel = "Good";
      strengthPercent = 75;
      strengthColor = "bg-[#6A80A9]";
    } else if (passedCount === 4) {
      strengthLabel = "Strong";
      strengthPercent = 100;
      strengthColor = "bg-[#3D5A32]";
    }
  }

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    passedCount,
    isComplete: passedCount === 4,
    strengthLabel,
    strengthPercent,
    strengthColor,
  };
}
