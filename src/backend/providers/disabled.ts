import { IntegrationNotConfiguredError, PROVIDER_ENVIRONMENT } from "@/backend/config";
import { estimateTranscriptAnalysis, estimateXVideoAnalysis, estimateYouTubeVideoAnalysis } from "@/backend/costs";
import type { ProviderId } from "@/domain/operations";
import type {
  AnalysisProvider,
  AssetProvider,
  BillingProvider,
  CanonicalMediaResolver,
  DiscoveryProvider,
  EphemeralAnalysisInput,
  NotificationProvider,
  ProviderContext,
} from "@/backend/providers/contracts";

const disabled = (provider: ProviderId): never => {
  throw new IntegrationNotConfiguredError(provider, PROVIDER_ENVIRONMENT[provider] ?? ["provider configuration"]);
};

export class DisabledDiscoveryProvider implements DiscoveryProvider {
  constructor(readonly id: ProviderId) {}
  async discover(): ReturnType<DiscoveryProvider["discover"]> {
    return disabled(this.id);
  }
}

export class DisabledCanonicalMediaResolver implements CanonicalMediaResolver {
  async resolve(): ReturnType<CanonicalMediaResolver["resolve"]> {
    return disabled("youtube");
  }
}

export class DisabledAnalysisProvider implements AnalysisProvider {
  readonly routes;

  constructor(readonly id: ProviderId, routes: AnalysisProvider["routes"]) {
    this.routes = routes;
  }

  estimate(input: EphemeralAnalysisInput) {
    if (input.route === "pasted-transcript") return estimateTranscriptAnalysis(input.transcript);
    if (input.route === "youtube-video") return estimateYouTubeVideoAnalysis(input.durationSeconds, "low");
    return estimateXVideoAnalysis();
  }

  async analyze(_input: EphemeralAnalysisInput, _context: ProviderContext): ReturnType<AnalysisProvider["analyze"]> {
    return disabled(this.id);
  }
}

export class DisabledAssetProvider implements AssetProvider {
  constructor(readonly id: ProviderId) {}
  async search(): ReturnType<AssetProvider["search"]> {
    return disabled(this.id);
  }
  async approve(): ReturnType<AssetProvider["approve"]> {
    return disabled(this.id);
  }
}

export class DisabledBillingProvider implements BillingProvider {
  readonly id = "stripe" as const;
  async createSubscriptionCheckout(): ReturnType<BillingProvider["createSubscriptionCheckout"]> {
    return disabled("stripe");
  }
  async createCustomerPortal(): ReturnType<BillingProvider["createCustomerPortal"]> {
    return disabled("stripe");
  }
  async verifyWebhook(): ReturnType<BillingProvider["verifyWebhook"]> {
    return disabled("stripe");
  }
}

export class DisabledNotificationProvider implements NotificationProvider {
  readonly id = "resend" as const;
  async send(): ReturnType<NotificationProvider["send"]> {
    return disabled("resend");
  }
}
