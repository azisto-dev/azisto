import { networkInterfaces } from "node:os";

const localIPv4Addresses = Object.values(networkInterfaces())
  .flat()
  .filter(
    (address) =>
      address &&
      address.family === "IPv4" &&
      !address.internal
  )
  .map((address) => address.address);

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: localIPv4Addresses,
};

export default nextConfig;
