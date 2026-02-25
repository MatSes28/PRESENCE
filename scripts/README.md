# Scripts

## Device command polling (Test RFID Reader / Calibrate Sensors)

`device-poll-commands.mjs` is an example script that polls the API for pending commands and acknowledges them. Use it to test the dashboard **Test RFID Reader** and **Calibrate Sensors** buttons, or adapt it for your device/gateway.

**Requirements:** Node 18+ (for `fetch`).

**Usage:**

```bash
# From project root
export API_BASE_URL=https://your-presence-api.com   # optional; default http://localhost:3000
export DEVICE_API_KEY=pk_xxxx   # from IoT Devices in the app (device API key)
node scripts/device-poll-commands.mjs
```

The script polls `GET /api/iot/commands` every 15 seconds. When you click **Test RFID Reader** or **Calibrate Sensors** in Dashboard → RFID Tools, the server queues a command for the selected device(s). The script receives it, logs it, and calls `POST /api/iot/commands/:id/ack`. Implement your hardware actions (e.g. run test, run calibration) inside `handleCommand` in the script or in your firmware.
