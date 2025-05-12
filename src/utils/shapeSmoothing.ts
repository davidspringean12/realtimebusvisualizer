// utils/shapeSmoothing.ts
import { LatLng, SpeedProfile } from "../types/movement";

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

export function calculateCornerAngle(
    point1: LatLng,
    point2: LatLng,
    point3: LatLng
): number {
    const p1Lat= point1.lat * (Math.PI / 180);
    const p1Lng = point1.lng * (Math.PI / 180);
    const p2Lat = point2.lat * (Math.PI / 180);
    const p2Lng = point2.lng * (Math.PI / 180);
    const p3Lat = point3.lat * (Math.PI / 180);
    const p3Lng = point3.lng * (Math.PI / 180);

    const v1x = Math.cos(p1Lat) * Math.cos(p1Lng) - Math.cos(p2Lat) * Math.cos(p2Lng);
    const v1y = Math.cos(p1Lat) * Math.sin(p1Lng) - Math.cos(p2Lat) * Math.sin(p2Lng);
    const v1z = Math.sin(p1Lat) - Math.sin(p2Lat);

    const v2x = Math.cos(p3Lat) * Math.cos(p3Lng) - Math.cos(p2Lat) * Math.cos(p2Lng);
    const v2y = Math.cos(p3Lat) * Math.sin(p3Lng) - Math.cos(p2Lat) * Math.sin(p2Lng);
    const v2z = Math.sin(p3Lat) - Math.sin(p2Lat);

    const dot = v1x * v2x + v1y * v2y + v1z * v2z;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

    const angle = Math.acos(dot / (mag1 * mag2));
    return angle * (180 / Math.PI); // Convert to degrees
}

export function calculateTargetSpeed(angle: number): number {
    if (angle < 30) return 0.2;
    if (angle < 45) return 0.3;
    if (angle < 90) return 0.5;
    if (angle < 135) return 0.7;
    return 1.0;
}

export function calculateSpeedProfile(
    points: LatLng[],
    currentIndex: number,
    lookAheadPoints: number = 3
): SpeedProfile {
    const nextPoints = points.slice(
        currentIndex,
        currentIndex + lookAheadPoints + 1
    );

    if (nextPoints.length < 3) {
        return {
            currentSpeed: 1.0,
            targetSpeed: 1.0,
            distanceToCorner: Infinity
        };
    }

    let minTargetSpeed = 1.0;
    let distanceToCorner = 0;

    for (let i = 0; i < nextPoints.length - 2; i++) {
        const angle = calculateCornerAngle(
            nextPoints[i],
            nextPoints[i + 1],
            nextPoints[i + 2]
        );
        const targetSpeed = calculateTargetSpeed(angle);

        if (targetSpeed < minTargetSpeed) {
            minTargetSpeed = targetSpeed;
            for (let j = 0; j < i + 1; j++) {
                distanceToCorner += calculateDistance(
                    nextPoints[j],
                    nextPoints[j + 1]
                );
            }
        }
    }

    return {
        currentSpeed: calculateCurrentSpeed(minTargetSpeed, distanceToCorner),
        targetSpeed: minTargetSpeed,
        distanceToCorner
    };
}

function calculateCurrentSpeed(targetSpeed: number, distanceToCorner: number): number {
    const SLOWDOWN_DISTANCE = 10;

    if (distanceToCorner > SLOWDOWN_DISTANCE) {
        return 1.0;
    }

    const distanceFactor = distanceToCorner / SLOWDOWN_DISTANCE;
    const speedDiff = 1.0 - targetSpeed;

    return targetSpeed + (speedDiff * Math.pow(distanceFactor, 2));
}

export function calculateDistance(
    start: LatLng,
    end: LatLng
): number {
    const R = 6371e3; // metres
    const φ1 = start.lat * Math.PI / 180;
    const φ2 = end.lat * Math.PI / 180;
    const Δφ = (end.lat - start.lat) * Math.PI / 180;
    const Δλ = (end.lng - start.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in metres
}

