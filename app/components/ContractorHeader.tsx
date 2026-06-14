import type { ReactNode } from "react";
import AppHeader from "@/app/components/AppHeader";

export default function ContractorHeader({
  leftControl,
  rightControl,
  logoClassName,
}: {
  leftControl?: ReactNode;
  rightControl?: ReactNode;
  logoClassName?: string;
}) {
  return (
    <AppHeader
      leftControl={leftControl}
      rightControl={rightControl}
      logoClassName={logoClassName}
    />
  );
}
