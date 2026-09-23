/**
 * Returns the microphone to capture from: the explicit device if given,
 * otherwise the one saved in Settings (audioInputDeviceId), otherwise undefined (OS default).
 * @param explicit - Device ID chosen by the caller, if any.
 * @returns The device ID to request, or undefined for the OS default.
 */
export async function resolveInputDeviceId(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  try {
    const keys = await window.electronAPI?.getApiKeys?.()
    return keys?.audioInputDeviceId || undefined
  } catch {
    return undefined
  }
}
