import type { PickedFile } from '@/lib/filePickerShared';

export interface CmrScannerProps {
  visible: boolean;
  onCancel: () => void;
  onDone: (file: PickedFile) => void;
}

/**
 * Platzhalter für die native App: Der Scanner (CmrScanner.web.tsx) rechnet
 * mit <canvas> im Browser. Ein nativer Scanner bräuchte ein eigenes Modul
 * (ML Kit/VisionKit) und damit einen Development Build. OrderDocuments
 * blendet den Scan-Button nativ deshalb gar nicht erst ein.
 */
export function CmrScanner(_props: CmrScannerProps) {
  return null;
}
