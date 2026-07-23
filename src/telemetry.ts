import * as vscode from "vscode";
import { TelemetryReporter } from "@vscode/extension-telemetry";
import * as os from "os";

// This value is injected at build time from .env
declare const TELEMETRY_CONNECTION_STRING: string;

let telemetryReporter: TelemetryReporter | undefined;

/**
 * Feature adoption tracking
 */
const featureUsage = {
  didOpenPRFromStatusBar: false,
  didUseInvestigateChat: false,
  quickPickUsageCount: 0,
};

/**
 * Gather system and environment information for telemetry
 */
function getSystemInfo(): Record<string, string> {
  return {
    osType: os.type(), // "Darwin" | "Windows_NT" | "Linux"
    osRelease: os.release(), // Version number
    osPlatform: process.platform, // "darwin" | "win32" | "linux"
    nodeVersion: process.version, // e.g., "v22.19.0"
    arch: os.arch(), // "arm64" | "x64" etc
    cpuCount: String(os.cpus().length),
  };
}

/**
 * Initialize telemetry reporter
 * Automatically respects user's global privacy settings
 */
export function initTelemetry(context: vscode.ExtensionContext): void {
  if (!TELEMETRY_CONNECTION_STRING) {
    console.warn(
      "Telemetry connection string not configured. Telemetry disabled.",
    );
    return;
  }

  try {
    telemetryReporter = new TelemetryReporter(TELEMETRY_CONNECTION_STRING);
    context.subscriptions.push(telemetryReporter);
    console.log("✅ Telemetry activated with Application Insights");

    // Send system information with activation event
    const systemInfo = getSystemInfo();
    const vscodeVersion = vscode.version;
    const extensionVersion = context.extension.packageJSON.version;

    sendTelemetryEvent("extensionActivated", {
      extensionVersion,
      vscodeVersion,
      osType: systemInfo.osType,
      osRelease: systemInfo.osRelease,
      osPlatform: systemInfo.osPlatform,
      nodeVersion: systemInfo.nodeVersion,
      arch: systemInfo.arch,
      cpuCount: systemInfo.cpuCount,
    });
  } catch (error) {
    console.error("Failed to initialize telemetry:", error);
  }
}

/**
 * Send a telemetry event
 * @param eventName - The name of the event
 * @param properties - Optional object properties
 * @param measurements - Optional numeric measurements
 */
export function sendTelemetryEvent(
  eventName: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>,
): void {
  if (!telemetryReporter) {
    return;
  }

  try {
    telemetryReporter.sendTelemetryEvent(eventName, properties, measurements);
  } catch (error) {
    console.error(`Failed to send telemetry event '${eventName}':`, error);
  }
}

/**
 * Dispose telemetry reporter
 * Call this when the extension is deactivated
 */
export function disposeTelemetry(): void {
  if (telemetryReporter) {
    telemetryReporter.dispose();
    telemetryReporter = undefined;
  }
}

/**
 * Track PR opened from status bar
 */
export function trackPROpened(): void {
  featureUsage.didOpenPRFromStatusBar = true;
  sendTelemetryEvent("featureUsed", { feature: "openPRFromStatusBar" });
}

/**
 * Track investigate chat usage
 */
export function trackInvestigateUsage(): void {
  featureUsage.didUseInvestigateChat = true;
  sendTelemetryEvent("featureUsed", { feature: "investigateChat" });
}

/**
 * Track quick pick menu usage
 */
export function trackQuickPickUsage(): void {
  featureUsage.quickPickUsageCount++;
  sendTelemetryEvent("featureUsed", {
    feature: "quickPick",
    usageCount: String(featureUsage.quickPickUsageCount),
  });
}

/**
 * Get current feature adoption metrics
 */
export function getFeatureAdoptionMetrics(): Record<string, string | number> {
  return {
    didOpenPRFromStatusBar: String(featureUsage.didOpenPRFromStatusBar),
    didUseInvestigateChat: String(featureUsage.didUseInvestigateChat),
    quickPickUsageCount: featureUsage.quickPickUsageCount,
  };
}
