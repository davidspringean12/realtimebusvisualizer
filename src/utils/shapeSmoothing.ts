// utils/shapeSmoothing.ts
export type LatLng = {
    lat: number;
    lng: number;
};

/**
 * Filter out points that are too close together
 */
export function filterClosePoints(points: LatLng[], minDistance = 0.00005): LatLng[] {
    return points.filter((point, i, arr) => {
        if (i === 0) return true;
        const prev = arr[i - 1];
        const dist = Math.hypot(point.lat - prev.lat, point.lng - prev.lng);
        return dist > minDistance;
    });
}

/**
 * Chaikin's algorithm for smoothing a path
 */
export function chaikinSmoothing(points: LatLng[], iterations = 2): LatLng[] {
    for (let it = 0; it < iterations; it++) {
        const newPoints: LatLng[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const Q = {
                lat: 0.75 * p0.lat + 0.25 * p1.lat,
                lng: 0.75 * p0.lng + 0.25 * p1.lng,
            };
            const R = {
                lat: 0.25 * p0.lat + 0.75 * p1.lat,
                lng: 0.25 * p0.lng + 0.75 * p1.lng,
            };
            newPoints.push(Q, R);
        }
        points = [points[0], ...newPoints, points[points.length - 1]];
    }
    return points;
}

/**
 * Utility to clean and smooth GTFS shape points
 */
export function preprocessShapePoints(points: LatLng[]): LatLng[] {
    const filtered = filterClosePoints(points);
    return chaikinSmoothing(filtered);
}