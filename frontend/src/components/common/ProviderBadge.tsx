import type { ProviderName } from "../../types";

const MARK: Record<ProviderName, string> = { AWS: "aws", Azure: "az", GCP: "gcp" };
const NAME: Record<ProviderName, string> = { AWS: "AWS", Azure: "Azure", GCP: "Google Cloud" };

/** Neutral monogram, used for identity only; never as a semantic color. */
export function ProviderMark({ provider, size = 28 }: { provider: ProviderName; size?: number }) {
  return (
    <span className={`pmark pmark-${provider}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {MARK[provider]}
    </span>
  );
}

export function ProviderBadge({ provider, showName = true }: { provider: ProviderName; showName?: boolean }) {
  return (
    <span className="pbadge">
      <ProviderMark provider={provider} size={22} />
      {showName ? <span>{NAME[provider]}</span> : <span className="sr-only">{NAME[provider]}</span>}
    </span>
  );
}
