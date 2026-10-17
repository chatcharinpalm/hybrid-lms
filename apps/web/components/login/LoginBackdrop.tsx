import { SunsetScene } from "./SunsetScene";

/**
 * Which backdrop the login page uses.
 * "photo"  = the faculty building photo at /brand/login-bg.jpg
 * "sunset" = the original dusk sky (SunsetScene) (current)
 * Change this one word to switch.
 */
export const LOGIN_BACKDROP: "photo" | "sunset" = "sunset";

export function LoginBackdrop() {
  if (LOGIN_BACKDROP === "sunset") return <SunsetScene />;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0b0508]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/brand/login-bg.jpg)" }} />
      {/* Darkens the photo so the login cards stay readable. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0508]/85 via-[#0b0508]/45 to-[#0b0508]/75" />
    </div>
  );
}
