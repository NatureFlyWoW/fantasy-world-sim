/**
 * Climate generation based on latitude, elevation, and ocean proximity.
 * Produces temperature and rainfall maps.
 */

/**
 * Climate data for a single tile.
 */
export interface ClimateData {
  /** Temperature in degrees Celsius */
  temperature: number;
  /** Annual rainfall in cm */
  rainfall: number;
}

/**
 * Full climate map: climateMap[y][x].
 */
export type ClimateMap = readonly (readonly ClimateData[])[];

export class ClimateGenerator {
  /**
   * Generate climate data for the entire map.
   */
  generateClimate(heightmap: number[][], width: number): ClimateMap {
    const mapHeight = heightmap.length;
    if (mapHeight === 0) return [];

    // Pre-compute ocean distance map for each tile
    const oceanDist = this.computeOceanDistance(heightmap, width, mapHeight);

    const climate: ClimateData[][] = [];

    for (let y = 0; y < mapHeight; y++) {
      const row: ClimateData[] = [];
      for (let x = 0; x < width; x++) {
        const elevation = heightmap[y]![x]!;
        const temperature = this.computeTemperature(y, mapHeight, elevation, oceanDist[y]![x]!);
        const rainfall = this.computeRainfall(x, y, width, mapHeight, elevation, oceanDist[y]![x]!, heightmap);

        row.push({ temperature, rainfall });
      }
      climate.push(row);
    }

    return climate;
  }

  /**
   * Temperature based on latitude, elevation, and ocean proximity.
   * Equator is hot (y = height/2), poles are cold (y = 0 and y = height-1).
   * Higher elevation = colder. Coastal areas are more moderate.
   */
  private computeTemperature(
    y: number,
    mapHeight: number,
    elevation: number,
    oceanDistance: number
  ): number {
    // Latitude factor: 0 at poles, 1 at equator
    const latitudeRatio = 1 - 2 * Math.abs(y / mapHeight - 0.5);
    // Base temp: -30°C at poles, +35°C at equator
    const baseTemp = -30 + latitudeRatio * 65;

    // Elevation cooling: ~6.5°C per 1000m (lapse rate)
    const elevationMeters = Math.max(0, elevation);
    const elevationCooling = (elevationMeters / 1000) * 6.5;

    // Ocean moderation: coastal areas have less extreme temperatures
    const moderationFactor = Math.max(0, 1 - oceanDistance / 30);
    const moderation = moderationFactor * 5;
    const moderatedTemp = baseTemp > 20
      ? baseTemp - moderation
      : baseTemp + moderation;

    return Math.round((moderatedTemp - elevationCooling) * 10) / 10;
  }

  /**
   * Rainfall based on ocean proximity, wind patterns, and rain shadow.
   * Areas near ocean get more rain. Mountains block moisture (rain shadow).
   */
  private computeRainfall(
    x: number,
    y: number,
    _width: number,
    mapHeight: number,
    elevation: number,
    oceanDistance: number,
    heightmap: number[][]
  ): number {
    // Underwater areas don't need rainfall
    if (elevation < 0) return 0;

    // Base moisture from ocean proximity
    const oceanMoisture = Math.max(0, 200 - oceanDistance * 8);

    // Latitude-based prevailing wind direction (simplified)
    // Equatorial convergence zone gets more rain
    const latitudeRatio = 1 - 2 * Math.abs(y / mapHeight - 0.5);
    const equatorialBoost = latitudeRatio > 0.7 ? (latitudeRatio - 0.7) * 200 : 0;

    // Rain shadow: check for mountains to the west (prevailing winds)
    let rainShadow = 0;
    const lookback = Math.min(30, x);
    for (let dx = 1; dx <= lookback; dx++) {
      const checkElev = heightmap[y]![x - dx]!;
      if (checkElev > 4000) {
        rainShadow = Math.min(0.8, rainShadow + 0.15);
      }
    }

    // Mountain uplift: windward side of mountains gets extra rain
    const windwardBoost = elevation > 1000 && elevation < 4000 && rainShadow < 0.3
      ? (elevation / 1000) * 20
      : 0;

    const baseRainfall = oceanMoisture + equatorialBoost + windwardBoost;
    const rainfall = baseRainfall * (1 - rainShadow);

    return Math.max(0, Math.round(rainfall * 10) / 10);
  }

  /**
   * Compute distance to nearest ocean tile for each cell.
   * Uses a BFS flood from all ocean tiles.
   */
  private computeOceanDistance(
    heightmap: number[][],
    width: number,
    height: number
  ): number[][] {
    const dist: number[][] = [];
    const queue: Array<[number, number]> = [];

    // Initialize: ocean tiles are distance 0, land tiles are Infinity
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const elev = heightmap[y]![x]!;
        if (elev <= 0) {
          row.push(0);
          queue.push([x, y]);
        } else {
          row.push(Infinity);
        }
      }
      dist.push(row);
    }

    // BFS flood fill
    let head = 0;
    const cardinals: ReadonlyArray<readonly [number, number]> = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
    ];

    while (head < queue.length) {
      const item = queue[head]!;
      head++;
      const [cx, cy] = item;
      const currentDist = dist[cy]![cx]!;

      for (const [dx, dy] of cardinals) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (dist[ny]![nx]! <= currentDist + 1) continue;

        dist[ny]![nx] = currentDist + 1;
        queue.push([nx, ny]);
      }
    }

    return dist;
  }
}
