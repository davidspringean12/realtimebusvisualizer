import { filterClosePoints, chaikinSmoothing, preprocessShapePoints, LatLng } from './shapeSmoothing';

describe('shapeSmoothing utilities', () => {
    const samplePoints: LatLng[] = [
        { lat: 0, lng: 0 },
        { lat: 0.00001, lng: 0.00001 },
        { lat: 0.0001, lng: 0.0001 },
        { lat: 0.001, lng: 0.001 },
        { lat: 0.01, lng: 0.01 },
    ];

    describe('filterClosePoints', () => {
        it('should filter out points that are too close together', () => {
            const result = filterClosePoints(samplePoints, 0.00005);
            expect(result).toEqual([
                { lat: 0, lng: 0 },
                { lat: 0.0001, lng: 0.0001 },
                { lat: 0.001, lng: 0.001 },
                { lat: 0.01, lng: 0.01 },
            ]);
        });

        it('should return all points if minDistance is very small', () => {
            const result = filterClosePoints(samplePoints, 0.000001);
            expect(result).toEqual(samplePoints);
        });

        it('should return only the first point if minDistance is very large', () => {
            const result = filterClosePoints(samplePoints, 0.1);
            expect(result).toEqual([{ lat: 0, lng: 0 }]);
        });
    });

    describe('chaikinSmoothing', () => {
        it('should smooth the points using Chaikin\'s algorithm', () => {
            const result = chaikinSmoothing(samplePoints, 1);
            expect(result.length).toBeGreaterThan(samplePoints.length);
        });

        it('should preserve the first and last points', () => {
            const result = chaikinSmoothing(samplePoints, 2);
            expect(result[0]).toEqual(samplePoints[0]);
            expect(result[result.length - 1]).toEqual(samplePoints[samplePoints.length - 1]);
        });
    });

    describe('preprocessShapePoints', () => {
        it('should filter and smooth the points', () => {
            const result = preprocessShapePoints(samplePoints);
            expect(result.length).toBeGreaterThan(1);
            expect(result[0]).toEqual(samplePoints[0]);
            expect(result[result.length - 1]).toEqual(samplePoints[samplePoints.length - 1]);
        });
    });
});