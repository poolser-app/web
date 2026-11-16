import type { Address } from 'viem';
import type { StorageLike } from './types.ts';

// Native ChainConfig.swift at 215682391bcacc9ccb55f2e051bddd608512b42f.
export type Network = {
  slug: string; name: string; id: number; infuraHost: string;
  pricePlatform: string; priceChain: string; factory: Address | null; v3: Address | null;
  wrappedNative: Address; v4: Address | null; stateView: Address | null;
  v4Deployment: bigint | null; v3Deployment: number | null; multicall: Address | null;
  nativeSymbol: string; uniswapSlug: string; iconURL: string; publicRPC: string | null;
};
const canonicalMulticall = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const networks: Network[] = [
  {
    slug: 'ethereum', name: 'Ethereum', id: 1,
    infuraHost: 'mainnet', pricePlatform: 'ethereum', priceChain: 'ethereum',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', v3: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    v4: '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e', stateView: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227', v4Deployment: 0x14af301n,
    v3Deployment: 12369621, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'mainnet', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/279/large/ethereum.png', publicRPC: 'https://eth.drpc.org',
  },
  {
    slug: 'base', name: 'Base', id: 8453,
    infuraHost: 'base-mainnet', pricePlatform: 'base', priceChain: 'base',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', v3: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', wrappedNative: '0x4200000000000000000000000000000000000006',
    v4: '0x7c5f5a4bbd8fd63184577525326123b519429bdc', stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', v4Deployment: 0x182d351n,
    v3Deployment: 1371680, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'base', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/131/large/base.png', publicRPC: 'https://base.drpc.org',
  },
  {
    slug: 'arbitrum', name: 'Arbitrum', id: 42161,
    infuraHost: 'arbitrum-mainnet', pricePlatform: 'arbitrum-one', priceChain: 'arbitrum',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', v3: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    v4: '0xd88f38f930b7952f2db2432cb002e7abbf3dd869', stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990', v4Deployment: 0x11c0b8cdn,
    v3Deployment: 222817, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'arbitrum', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/33/large/AO_logomark.png', publicRPC: 'https://arbitrum.drpc.org',
  },
  {
    slug: 'optimism', name: 'Optimism', id: 10,
    infuraHost: 'optimism-mainnet', pricePlatform: 'optimistic-ethereum', priceChain: 'optimism',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', v3: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', wrappedNative: '0x4200000000000000000000000000000000000006',
    v4: '0x3c3ea4b57a46241e54610e5f022e5c45859a1017', stateView: '0xc18a3169788f4f75a170290584eca6395c75ecdb', v4Deployment: 0x7ce22bbn,
    v3Deployment: 3936000, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'optimism', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/41/large/optimism.png', publicRPC: 'https://optimism.drpc.org',
  },
  {
    slug: 'polygon', name: 'Polygon', id: 137,
    infuraHost: 'polygon-mainnet', pricePlatform: 'polygon-pos', priceChain: 'polygon',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', v3: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', wrappedNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    v4: '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9', stateView: '0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a', v4Deployment: 0x3fe0a2an,
    v3Deployment: 22757547, multicall: canonicalMulticall, nativeSymbol: 'POL',
    uniswapSlug: 'polygon', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/15/large/polygon_pos.png', publicRPC: 'https://polygon.drpc.org',
  },
  {
    slug: 'blast', name: 'Blast', id: 81457,
    infuraHost: 'blast-mainnet', pricePlatform: 'blast', priceChain: 'blast',
    factory: '0x792edAdE80af5fC680d96a2eD80A44247D2Cf6Fd', v3: '0xB218e4f7cF0533d4696fDfC419A0023D33345F28', wrappedNative: '0x4300000000000000000000000000000000000004',
    v4: '0x4ad2f4cca2682cbb5b950d660dd458a1d3f1baad', stateView: '0x12a88ae16f46dce4e8b15368008ab3380885df30', v4Deployment: 0xdb6164n,
    v3Deployment: 400000, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'blast', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/192/large/blast.jpeg', publicRPC: 'https://blast.drpc.org',
  },
  {
    slug: 'palm', name: 'Palm', id: 11297108109,
    infuraHost: 'palm-mainnet', pricePlatform: 'palm', priceChain: 'palm',
    factory: null, v3: null, wrappedNative: '0x0000000000000000000000000000000000000000',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: null, multicall: null, nativeSymbol: 'ETH',
    uniswapSlug: 'palm', iconURL: 'https://icons.llamao.fi/icons/chains/rsz_palm.jpg', publicRPC: null,
  },
  {
    slug: 'avalanche', name: 'Avalanche', id: 43114,
    infuraHost: 'avalanche-mainnet', pricePlatform: 'avalanche', priceChain: 'avax',
    factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD', v3: '0x655C406EBFa14EE2006250925e54ec43AD184f8B', wrappedNative: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 27832972, multicall: canonicalMulticall, nativeSymbol: 'AVAX',
    uniswapSlug: 'avalanche', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/12/large/avalanche.png', publicRPC: 'https://avalanche.drpc.org',
  },
  {
    slug: 'celo', name: 'Celo', id: 42220,
    infuraHost: 'celo-mainnet', pricePlatform: 'celo', priceChain: 'celo',
    factory: '0xAfE208a311B21f13EF87E33A90049fC17A7acDEc', v3: '0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A', wrappedNative: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 13916355, multicall: canonicalMulticall, nativeSymbol: 'CELO',
    uniswapSlug: 'celo', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/21/large/celo.jpeg', publicRPC: 'https://celo.drpc.org',
  },
  {
    slug: 'linea', name: 'Linea', id: 59144,
    infuraHost: 'linea-mainnet', pricePlatform: 'linea', priceChain: 'linea',
    factory: null, v3: null, wrappedNative: '0xE5D7C2a44fA3fAF9A34fD5E24D6fB95f27f7B4F0',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: null, multicall: null, nativeSymbol: 'ETH',
    uniswapSlug: 'linea', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/135/large/linea.jpeg', publicRPC: null,
  },
  {
    slug: 'mantle', name: 'Mantle', id: 5000,
    infuraHost: 'mantle-mainnet', pricePlatform: 'mantle', priceChain: 'mantle',
    factory: null, v3: null, wrappedNative: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: null, multicall: null, nativeSymbol: 'ETH',
    uniswapSlug: 'mantle', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/140/large/mantle.jpeg', publicRPC: null,
  },
  {
    slug: 'zksync', name: 'ZKsync', id: 324,
    infuraHost: 'zksync-mainnet', pricePlatform: 'zksync', priceChain: 'era',
    factory: '0x8FdA5a7a8dCA67BBcDd10F02Fa0649A937215422', v3: '0x0616e5762c1E7Dc3723c50663dF10a162D690a86', wrappedNative: '0x5AEA5775959fBC2557Cc8789bC1bf90A239D9a91',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 14000000, multicall: '0xF9cda624FBC7e059355ce98a31693d299FACd963', nativeSymbol: 'ETH',
    uniswapSlug: 'zksync', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/121/large/zksync.jpeg', publicRPC: 'https://zksync.drpc.org',
  },
  {
    slug: 'bsc', name: 'BSC', id: 56,
    infuraHost: 'bsc-mainnet', pricePlatform: 'binance-smart-chain', priceChain: 'bsc',
    factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7', v3: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613', wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 26975000, multicall: canonicalMulticall, nativeSymbol: 'BNB',
    uniswapSlug: 'bnb', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/1/large/bnb_smart_chain.png', publicRPC: 'https://bsc.drpc.org',
  },
  {
    slug: 'megaeth', name: 'MegaETH', id: 4326,
    infuraHost: 'megaeth-mainnet', pricePlatform: 'megaeth', priceChain: 'megaeth',
    factory: '0x3a5f0cd7d62452b7f899b2a5758bfa57be0de478', v3: '0xcdc86e98184e96436f733a8bf31bd4f0214e6d7d', wrappedNative: '0x4200000000000000000000000000000000000006',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 0, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'megaeth', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/32266/large/megaeth.jpg', publicRPC: 'https://mainnet.megaeth.com/rpc',
  },
  {
    slug: 'monad', name: 'Monad', id: 143,
    infuraHost: 'monad-mainnet', pricePlatform: 'monad', priceChain: 'monad',
    factory: '0x204faca1764b154221e35c0d20abb3c525710498', v3: '0x7197e214c0b767cfb76fb734ab638e2c192f4e53', wrappedNative: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    v4: null, stateView: null, v4Deployment: null,
    v3Deployment: 0, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'monad', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/22182/large/monad.png', publicRPC: 'https://rpc.monad.xyz',
  },
  {
    slug: 'unichain', name: 'Unichain', id: 130,
    infuraHost: 'unichain-mainnet', pricePlatform: 'unichain', priceChain: 'unichain',
    factory: '0x1f98400000000000000000000000000000000003', v3: '0x943e6e07a7e8e791dafc44083e54041d743c46e9', wrappedNative: '0x4200000000000000000000000000000000000006',
    v4: '0x4529a01c7a0410167c5740c487a8de60232617bf', stateView: '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2', v4Deployment: 0x680f5fn,
    v3Deployment: 0, multicall: canonicalMulticall, nativeSymbol: 'ETH',
    uniswapSlug: 'unichain', iconURL: 'https://coin-images.coingecko.com/asset_platforms/images/22206/large/unichain.png', publicRPC: 'https://unichain.drpc.org',
  },
];
export const supportsV3 = (n: Network) => n.v3 !== null && n.factory !== null;
export const supportsV4 = (n: Network) => n.v4 !== null && n.stateView !== null && n.v4Deployment !== null;
// Blast stays in the native reference but is excluded from browser monitoring.
export const networkOptions = networks.filter(n => n.slug !== 'blast');
export const supportedNetworks = networkOptions.filter(n => supportsV3(n) || supportsV4(n));
export const networkById = (id: number): Network => {
  const network = networks.find(n => n.id === id);
  if (!network) throw new Error('Unknown network.');
  return network;
};
export const ethereum = networks[0];
export const networkSelectionKey = 'poolser:enabled-networks';
export function validSelection(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every(id => supportedNetworks.some(n => n.id === id));
}
export function readNetworks(storage: StorageLike | null): { ids: number[]; warning?: string } {
  try {
    if (!storage) throw new Error();
    const raw = storage.getItem(networkSelectionKey);
    if (raw === null) return { ids: [1] };
    const saved: unknown = JSON.parse(raw);
    if (Array.isArray(saved) && new Set(saved).size !== saved.length) throw new Error();
    const removedBlast = Array.isArray(saved) && saved.includes(81457);
    const ids: unknown = removedBlast ? saved.filter(id => id !== 81457) : saved;
    if (!validSelection(ids)) throw new Error();
    return { ids, ...(removedBlast ? { warning: 'Blast is no longer monitored and was removed from the saved selection. Review Networks before saving.' } : {}) };
  } catch { return { ids: [1], warning: 'Saved networks could not be read. Ethereum is selected; review Networks before saving.' }; }
}
export function saveNetworks(storage: StorageLike | null, ids: number[]): string | null {
  if (!validSelection(ids)) throw new Error('Select at least one supported network.');
  try { if (!storage) throw new Error(); storage.setItem(networkSelectionKey, JSON.stringify(ids)); return null; }
  catch { return 'Enabled networks could not be saved. This selection lasts only in this tab.'; }
}
export function rpcEndpoint(network: Network, publicRPC: boolean, key: string): string | null {
  return publicRPC ? network.publicRPC : `https://${network.infuraHost}.infura.io/v3/${key}`;
}
