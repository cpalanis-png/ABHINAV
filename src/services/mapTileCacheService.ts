/**
 * SmartShield Offline Map Tile Cache Service
 * Manages local caching of OpenStreetMap raster tiles in IndexedDB/LocalStorage
 * for offline emergency visualization and tactical GPS display.
 */

export interface CachedTileMetadata {
  tileCount: number;
  lastUpdatedIso: string | null;
  cachedCenter: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  approxSizeKb: number;
}

export interface MapTileCoords {
  z: number;
  x: number;
  y: number;
  key: string;
}

export interface OfflineMapMarker {
  id: string;
  type: 'user_location' | 'geofence_anchor' | 'emergency_contact' | 'safe_place';
  title: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  color?: string;
}

export interface OfflineMapViewSnapshot {
  id: string;
  savedAtIso: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
    timestamp?: number;
    status?: string;
  };
  anchorLocation: { latitude: number; longitude: number; address?: string } | null;
  geofenceRadiusKm: number;
  markers: OfflineMapMarker[];
  zoomLevel: number;
  tileCount: number;
}

const DB_NAME = 'smartshield_map_tiles_db';
const DB_VERSION = 2;
const STORE_NAME = 'tiles';
const VIEW_STORE_NAME = 'offline_views';
const METADATA_KEY = 'smartshield_tile_cache_metadata';
const SNAPSHOT_KEY = 'smartshield_offline_map_snapshot';

class MapTileCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in environment'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(VIEW_STORE_NAME)) {
          db.createObjectStore(VIEW_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB tile store'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Convert WGS84 Latitude & Longitude to OpenStreetMap Tile Coordinates (x, y) at a given zoom level (z)
   */
  public latLngToTile(lat: number, lng: number, zoom: number): MapTileCoords {
    const n = Math.pow(2, zoom);
    const rad = (lat * Math.PI) / 180;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
    const key = `${zoom}_${x}_${y}`;
    return { z: zoom, x, y, key };
  }

  /**
   * Convert OpenStreetMap Tile Coordinates (x,y,z) back to North-West Latitude & Longitude bounds
   */
  public tileToLatLngBounds(z: number, x: number, y: number): {
    north: number;
    south: number;
    west: number;
    east: number;
  } {
    const n = Math.pow(2, z);
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;

    const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));

    const north = (northRad * 180) / Math.PI;
    const south = (southRad * 180) / Math.PI;

    return { north, south, west, east };
  }

  /**
   * Calculate a grid of tile coordinates centered around a target lat/lng (e.g. 3x3 grid)
   */
  public getSurroundingTiles(lat: number, lng: number, zoom: number, radiusTiles = 1): MapTileCoords[] {
    const center = this.latLngToTile(lat, lng, zoom);
    const tiles: MapTileCoords[] = [];

    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
      for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        const key = `${zoom}_${x}_${y}`;
        tiles.push({ z: zoom, x, y, key });
      }
    }

    return tiles;
  }

  /**
   * Retrieves a cached tile base64 DataURL from IndexedDB or LocalStorage
   */
  public async getTileFromCache(key: string): Promise<string | null> {
    try {
      const db = await this.initDb();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      });
    } catch {
      // Fallback to LocalStorage
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(`maptile_${key}`) || null;
        }
      } catch {}
      return null;
    }
  }

  /**
   * Saves a tile base64 DataURL to IndexedDB (with LocalStorage backup)
   */
  public async saveTileToCache(key: string, dataUrl: string): Promise<void> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataUrl, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`maptile_${key}`, dataUrl);
        }
      } catch {}
    }
  }

  /**
   * Fetches an OpenStreetMap or CartoDB tile image from network and converts to base64 DataURL
   */
  private async fetchAndConvertTileDataUrl(z: number, x: number, y: number): Promise<string | null> {
    // Try multiple tile CDN mirrors for redundancy
    const tileUrls = [
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
      `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`
    ];

    for (const url of tileUrls) {
      try {
        const response = await fetch(url, {
          mode: 'cors',
          cache: 'force-cache'
        });

        if (response.ok) {
          const blob = await response.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch {}
    }

    return null;
  }

  /**
   * Generates a high-contrast vector fallback canvas tile if network tile servers are offline/blocked
   */
  private generateTacticalVectorTileDataUrl(z: number, x: number, y: number): string {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Dark tactical grid background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, 256, 256);

      // Grid lines
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;

      for (let i = 0; i < 256; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }

      // Border outline
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, 256, 256);

      // Coordinate text tag
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`z${z} / x${x} / y${y}`, 8, 20);
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Pre-caches surrounding tiles for a location at zoom levels 13, 14, 15, 16
   */
  public async cacheLocationMapTiles(
    lat: number,
    lng: number,
    address?: string,
    onProgress?: (progressPercent: number, currentTileKey: string) => void
  ): Promise<CachedTileMetadata> {
    const zooms = [13, 14, 15, 16];
    let allTilesToCache: MapTileCoords[] = [];

    for (const z of zooms) {
      const radius = z >= 15 ? 1 : 1; // 3x3 grid = 9 tiles per zoom level
      const tiles = this.getSurroundingTiles(lat, lng, z, radius);
      allTilesToCache = allTilesToCache.concat(tiles);
    }

    const total = allTilesToCache.length;
    let completed = 0;

    for (let i = 0; i < total; i++) {
      const tile = allTilesToCache[i];
      let dataUrl = await this.getTileFromCache(tile.key);

      if (!dataUrl) {
        dataUrl = await this.fetchAndConvertTileDataUrl(tile.z, tile.x, tile.y);
        if (!dataUrl) {
          // Generate vector tile fallback if offline
          dataUrl = this.generateTacticalVectorTileDataUrl(tile.z, tile.x, tile.y);
        }
        if (dataUrl) {
          await this.saveTileToCache(tile.key, dataUrl);
        }
      }

      completed++;
      if (onProgress) {
        onProgress(Math.round((completed / total) * 100), tile.key);
      }
    }

    const meta: CachedTileMetadata = {
      tileCount: total,
      lastUpdatedIso: new Date().toISOString(),
      cachedCenter: { latitude: lat, longitude: lng, address },
      approxSizeKb: Math.round((total * 18000) / 1024)
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
      }
    } catch {}

    return meta;
  }

  /**
   * Get metadata summary of cached tiles from LocalStorage
   */
  public getCacheMetadata(): CachedTileMetadata {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(METADATA_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            tileCount: parsed.tileCount || 0,
            lastUpdatedIso: parsed.lastUpdatedIso || null,
            cachedCenter: parsed.cachedCenter || null,
            approxSizeKb: parsed.approxSizeKb || 0
          };
        }
      }
    } catch {}

    return {
      tileCount: 0,
      lastUpdatedIso: null,
      cachedCenter: null,
      approxSizeKb: 0
    };
  }

  /**
   * Clear all map tiles from IndexedDB and LocalStorage
   */
  public async clearTileCache(): Promise<void> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(METADATA_KEY);
        // Clear maptile_ keys
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('maptile_')) {
            localStorage.removeItem(k);
          }
        });
      }
    } catch {}
  }
  /**
   * Persist active map view and markers snapshot to IndexedDB (with LocalStorage backup)
   */
  public async saveOfflineMapView(snapshot: OfflineMapViewSnapshot): Promise<void> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VIEW_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const request = store.put(snapshot, 'active_view');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      }
    } catch {}
  }

  /**
   * Retrieve persisted active map view snapshot from IndexedDB or LocalStorage
   */
  public async getOfflineMapView(): Promise<OfflineMapViewSnapshot | null> {
    try {
      const db = await this.initDb();
      const snapshotFromDb = await new Promise<OfflineMapViewSnapshot | null>((resolve) => {
        const transaction = db.transaction(VIEW_STORE_NAME, 'readonly');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const request = store.get('active_view');

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });

      if (snapshotFromDb) return snapshotFromDb;
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}

    return null;
  }

  /**
   * Clear active offline map view snapshot from IndexedDB and LocalStorage
   */
  public async clearOfflineMapView(): Promise<void> {
    try {
      const db = await this.initDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VIEW_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VIEW_STORE_NAME);
        const request = store.delete('active_view');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SNAPSHOT_KEY);
      }
    } catch {}
  }
}

export const mapTileCacheService = new MapTileCacheService();
