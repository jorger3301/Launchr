/**
 * Metaplex Digital Asset Standard (DAS) Service
 *
 * Token metadata, images, and on-chain asset information.
 * https://developers.metaplex.com/
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface MetaplexConfig {
  rpcEndpoint: string;
}

interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: TokenAttribute[];
  collection?: {
    verified: boolean;
    key: string;
    name?: string;
  };
  creators?: TokenCreator[];
  royalty?: number;
  isMutable: boolean;
  primarySaleHappened: boolean;
  tokenStandard?: string;
}

interface TokenAttribute {
  trait_type: string;
  value: string | number;
}

interface TokenCreator {
  address: string;
  share: number;
  verified: boolean;
}

interface AssetContent {
  json_uri: string;
  files?: {
    uri: string;
    mime: string;
    cdn_uri?: string;
  }[];
  metadata: {
    name: string;
    symbol: string;
    description?: string;
    attributes?: TokenAttribute[];
  };
  links?: {
    image?: string;
    external_url?: string;
    animation_url?: string;
  };
}

interface DASAsset {
  id: string;
  interface: string;
  content: AssetContent;
  authorities: { address: string; scopes: string[] }[];
  compression?: {
    eligible: boolean;
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
  grouping: { group_key: string; group_value: string }[];
  royalty: {
    royalty_model: string;
    target: null;
    percent: number;
    basis_points: number;
    primary_sale_happened: boolean;
    locked: boolean;
  };
  creators: TokenCreator[];
  ownership: {
    frozen: boolean;
    delegated: boolean;
    delegate: string | null;
    ownership_model: string;
    owner: string;
  };
  supply?: {
    print_max_supply: number;
    print_current_supply: number;
    edition_nonce: number | null;
  };
  mutable: boolean;
  burnt: boolean;
}

interface SearchAssetsParams {
  ownerAddress?: string;
  creatorAddress?: string;
  grouping?: [string, string];
  page?: number;
  limit?: number;
  sortBy?: { sortBy: 'created' | 'updated' | 'recent_action'; sortDirection: 'asc' | 'desc' };
}

interface OffChainMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: TokenAttribute[];
  properties?: {
    files?: { uri: string; type: string }[];
    category?: string;
  };
}

// ---------------------------------------------------------------------------
// METAPLEX SERVICE
// ---------------------------------------------------------------------------

export class MetaplexService {
  private rpcEndpoint: string;
  private metadataCache: Map<string, { data: TokenMetadata; timestamp: number }> = new Map();
  private cacheDuration: number = 300000; // 5 minutes

  constructor(config: MetaplexConfig) {
    this.rpcEndpoint = config.rpcEndpoint;
  }

  // ---------------------------------------------------------------------------
  // DIGITAL ASSET STANDARD (DAS) API
  // ---------------------------------------------------------------------------

  /**
   * Get asset by mint address
   */
  async getAsset(mintAddress: string): Promise<DASAsset | null> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-get-asset',
          method: 'getAsset',
          params: { id: mintAddress },
        }),
      });

      const data = await response.json() as { result?: DASAsset; error?: { message: string } };

      if (data.error) {
        logger.warn(`DAS getAsset error: ${data.error.message}`);
        return null;
      }

      return data.result || null;
    } catch (error) {
      logger.error('Error fetching DAS asset:', error);
      return null;
    }
  }

  /**
   * Get token metadata with caching
   */
  async getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    const asset = await this.getAsset(mintAddress);
    if (!asset) return null;

    // Fetch off-chain JSON metadata if available
    let offChainMetadata: OffChainMetadata | null = null;
    if (asset.content.json_uri) {
      try {
        const jsonResponse = await fetch(asset.content.json_uri);
        offChainMetadata = await jsonResponse.json() as OffChainMetadata;
      } catch (err) {
        logger.warn(`Failed to fetch off-chain metadata for ${mintAddress}`);
      }
    }

    const metadata: TokenMetadata = {
      mint: mintAddress,
      name: asset.content.metadata.name,
      symbol: asset.content.metadata.symbol,
      uri: asset.content.json_uri,
      image: this.resolveImageUri(asset, offChainMetadata),
      description: asset.content.metadata.description || offChainMetadata?.description,
      attributes: asset.content.metadata.attributes || offChainMetadata?.attributes,
      collection: this.extractCollection(asset),
      creators: asset.creators,
      royalty: asset.royalty.percent,
      isMutable: asset.mutable,
      primarySaleHappened: asset.royalty.primary_sale_happened,
      tokenStandard: asset.interface,
    };

    // Cache the result
    this.metadataCache.set(mintAddress, { data: metadata, timestamp: Date.now() });

    return metadata;
  }

  /**
   * Get multiple token metadata in batch
   */
  async getMultipleTokenMetadata(mintAddresses: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();

    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-get-assets-batch',
          method: 'getAssetBatch',
          params: { ids: mintAddresses },
        }),
      });

      const data = await response.json() as { result?: DASAsset[] };

      if (data.result) {
        for (const asset of data.result) {
          if (asset) {
            const metadata: TokenMetadata = {
              mint: asset.id,
              name: asset.content.metadata.name,
              symbol: asset.content.metadata.symbol,
              uri: asset.content.json_uri,
              image: this.resolveImageUri(asset, null),
              description: asset.content.metadata.description,
              attributes: asset.content.metadata.attributes,
              collection: this.extractCollection(asset),
              creators: asset.creators,
              royalty: asset.royalty.percent,
              isMutable: asset.mutable,
              primarySaleHappened: asset.royalty.primary_sale_happened,
              tokenStandard: asset.interface,
            };

            results.set(asset.id, metadata);
            this.metadataCache.set(asset.id, { data: metadata, timestamp: Date.now() });
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching batch token metadata:', error);
    }

    return results;
  }

  /**
   * Search assets by owner
   */
  async getAssetsByOwner(
    ownerAddress: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<DASAsset[]> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-assets-by-owner',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress,
            page: options.page || 1,
            limit: options.limit || 100,
            displayOptions: {
              showFungible: true,
              showNativeBalance: false,
            },
          },
        }),
      });

      const data = await response.json() as { result?: { items: DASAsset[] } };
      return data.result?.items || [];
    } catch (error) {
      logger.error('Error fetching assets by owner:', error);
      return [];
    }
  }

  /**
   * Search assets by creator
   */
  async getAssetsByCreator(
    creatorAddress: string,
    options: { page?: number; limit?: number; onlyVerified?: boolean } = {}
  ): Promise<DASAsset[]> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-assets-by-creator',
          method: 'getAssetsByCreator',
          params: {
            creatorAddress,
            onlyVerified: options.onlyVerified ?? true,
            page: options.page || 1,
            limit: options.limit || 100,
          },
        }),
      });

      const data = await response.json() as { result?: { items: DASAsset[] } };
      return data.result?.items || [];
    } catch (error) {
      logger.error('Error fetching assets by creator:', error);
      return [];
    }
  }

  /**
   * Search assets by collection/group
   */
  async getAssetsByGroup(
    groupKey: string,
    groupValue: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<DASAsset[]> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-assets-by-group',
          method: 'getAssetsByGroup',
          params: {
            groupKey,
            groupValue,
            page: options.page || 1,
            limit: options.limit || 100,
          },
        }),
      });

      const data = await response.json() as { result?: { items: DASAsset[] } };
      return data.result?.items || [];
    } catch (error) {
      logger.error('Error fetching assets by group:', error);
      return [];
    }
  }

  /**
   * General asset search
   */
  async searchAssets(params: SearchAssetsParams): Promise<DASAsset[]> {
    try {
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'metaplex-search-assets',
          method: 'searchAssets',
          params: {
            ...params,
            page: params.page || 1,
            limit: params.limit || 100,
          },
        }),
      });

      const data = await response.json() as { result?: { items: DASAsset[] } };
      return data.result?.items || [];
    } catch (error) {
      logger.error('Error searching assets:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // IMAGE UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Resolve the best image URI from asset data
   */
  private resolveImageUri(asset: DASAsset, offChainMetadata: OffChainMetadata | null): string | undefined {
    // Priority: links.image > files[0].cdn_uri > files[0].uri > off-chain image
    if (asset.content.links?.image) {
      return this.convertToHttps(asset.content.links.image);
    }

    if (asset.content.files && asset.content.files.length > 0) {
      const imageFile = asset.content.files.find(
        f => f.mime?.startsWith('image/') || f.uri?.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
      );
      if (imageFile) {
        return this.convertToHttps(imageFile.cdn_uri || imageFile.uri);
      }
    }

    if (offChainMetadata?.image) {
      return this.convertToHttps(offChainMetadata.image);
    }

    return undefined;
  }

  /**
   * Convert IPFS/Arweave URIs to HTTPS gateway URLs
   */
  private convertToHttps(uri: string): string {
    if (!uri) return uri;

    // IPFS
    if (uri.startsWith('ipfs://')) {
      return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Arweave
    if (uri.startsWith('ar://')) {
      return uri.replace('ar://', 'https://arweave.net/');
    }

    return uri;
  }

  /**
   * Extract collection info from asset
   */
  private extractCollection(asset: DASAsset): TokenMetadata['collection'] | undefined {
    const collectionGroup = asset.grouping.find(g => g.group_key === 'collection');
    if (collectionGroup) {
      return {
        verified: true,
        key: collectionGroup.group_value,
      };
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  /**
   * Set cache duration
   */
  setCacheDuration(ms: number): void {
    this.cacheDuration = ms;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; duration: number } {
    return {
      size: this.metadataCache.size,
      duration: this.cacheDuration,
    };
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let metaplexService: MetaplexService | null = null;

export function initMetaplex(rpcEndpoint: string): MetaplexService {
  metaplexService = new MetaplexService({ rpcEndpoint });
  logger.info('Metaplex DAS service initialized');
  return metaplexService;
}

export function getMetaplex(): MetaplexService | null {
  return metaplexService;
}

export type { TokenMetadata, TokenAttribute, TokenCreator, DASAsset };
