// Zufallspasswörter für die Zugänge fremder Fahrer — beim Anlegen
// (create-external-driver) und beim Neu-Erstellen
// (reset-external-driver-password).

// Ohne Zeichen, die sich beim Abtippen verwechseln lassen (0/O, 1/l/I).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const PASSWORD_LENGTH = 12;

export function randomPassword(): string {
  // Nur Bytes unterhalb des größten Vielfachen der Alphabetlänge verwenden,
  // sonst kämen die ersten Zeichen des Alphabets häufiger vor.
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let password = "";
  while (password.length < PASSWORD_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH * 2));
    for (const byte of bytes) {
      if (byte < limit && password.length < PASSWORD_LENGTH) {
        password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      }
    }
  }
  return password;
}
