/**
 * In-memory emergency stop flag for RFID processing.
 * When set, processRFIDScan returns immediately without processing.
 */

let emergencyStopActive = false;

export function isEmergencyStopActive(): boolean {
  return emergencyStopActive;
}

export function setEmergencyStop(active: boolean): void {
  emergencyStopActive = active;
}
