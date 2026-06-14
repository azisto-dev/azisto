import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const port = process.env.PORT || "3000";
const localIPv4Address = Object.values(networkInterfaces())
  .flat()
  .find(
    (address) =>
      address &&
      address.family === "IPv4" &&
      !address.internal,
  )?.address;

if (localIPv4Address) {
  console.log(`\nAZISTO phone URL: http://${localIPv4Address}:${port}\n`);
} else {
  console.log("\nAZISTO phone URL unavailable: no active local IPv4 address.\n");
}

const nextDev = spawn(
  "next",
  ["dev", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit" },
);

nextDev.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
