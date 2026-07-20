const TerrainTypes = {
    WALLED: 'WALLED',
    WATER: 'WATER',
    DIRT: 'DIRT'
};

const TrackState = {
    segments: [],
    lastGlobalY: 0,
    baseMaxSpeed: 500,
    baseEnemyChance: 0.015,
    difficultyMultiplier: 1.0 
};

function initTrack() {
    TrackState.segments = [];
    TrackState.lastGlobalY = 0;
    TrackState.difficultyMultiplier = 1.0;
    
    addSegment({ type: TerrainTypes.WALLED, length: 1800, trackWidth: 400, hazardChance: 0.0 });
}

function generateNextSegments(currentGlobalY) {
    while (TrackState.lastGlobalY < currentGlobalY + 4000) {
        TrackState.difficultyMultiplier += 0.02; 
        
        let rand = Math.random();
        let type = TerrainTypes.WALLED;
        let length = 1200;
        let width = 400;
        let hz = 0;

        if (rand < 0.4) {
            type = TerrainTypes.WALLED;
            length = 1200;
            // Introduce wall beams as difficulty goes up
            if (TrackState.difficultyMultiplier > 1.2) {
                hz = 0.01 * TrackState.difficultyMultiplier;
            }
        } else if (rand < 0.6) {
            type = TerrainTypes.WATER;
            length = 600;
            width = 560;
        } else {
            type = TerrainTypes.DIRT;
            length = 1800;
            width = 560;
            hz = Math.min(0.015 * TrackState.difficultyMultiplier, 0.05);
        }

        let lastSeg = TrackState.segments[TrackState.segments.length - 1];
        if (lastSeg && lastSeg.type === type && lastSeg.trackWidth === width && lastSeg.hazardChance === hz) {
            lastSeg.endY += length;
        } else {
            TrackState.segments.push({
                type: type,
                startY: TrackState.lastGlobalY,
                endY: TrackState.lastGlobalY + length,
                trackWidth: width,
                hazardChance: hz
            });
        }
        TrackState.lastGlobalY += length;
    }
}

function addSegment(config) {
    config.startY = TrackState.lastGlobalY;
    config.endY = config.startY + config.length;
    TrackState.segments.push(config);
    TrackState.lastGlobalY = config.endY;
}
