const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * Load telemetry connection string from .env file
 */
function loadTelemetryConnectionString() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    console.warn("⚠️  .env file not found. Telemetry will be disabled.");
    return '""';
  }

  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("InstrumentationKey=")) {
        const instrumentationKey = trimmed
          .substring("InstrumentationKey=".length)
          .trim();
        if (instrumentationKey) {
          console.log(
            "✅ Telemetry enabled with InstrumentationKey from .env",
          );
          return JSON.stringify(`InstrumentationKey=${instrumentationKey}`);
        }
      }
    }

    console.warn(
      "⚠️  InstrumentationKey not found in .env. Telemetry will be disabled.",
    );
    return '""';
  } catch (error) {
    console.error("❌ Failed to read .env file:", error.message);
    return '""';
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const telemetryConnectionString = loadTelemetryConnectionString();

  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "silent",
    define: {
      TELEMETRY_CONNECTION_STRING: telemetryConnectionString,
    },
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
