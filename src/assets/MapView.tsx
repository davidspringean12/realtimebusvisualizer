import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { JSX, useEffect, useState, useCallback } from 'react';
import { parseGTFSShapes } from "../utils/gtfsParser";
import { preprocessShapePoints} from "../utils/shapeSmoothing";

const interpolate = (
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
    fraction: number
): google.maps.LatLngLiteral => ({
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction
});

export default function MapView(): JSX.Element {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    const [routes, setRoutes] = useState<google.maps.LatLngLiteral[]>([]);
    const [busPosition, setBusPosition] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
    const [currentSegment, setCurrentSegment] = useState(0);
    const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });

    const calculateDistance = (
        start: google.maps.LatLngLiteral,
        end: google.maps.LatLngLiteral
    ): number => {
        const R = 6371e3;
        const toRadians = (degrees: number) => degrees * Math.PI / 180;

        const lat1 = toRadians(start.lat);
        const lat2 = toRadians(end.lat);
        const deltaLat = toRadians(end.lat - start.lat);
        const deltaLng = toRadians(end.lng - start.lng);

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // in meters
    }

    const animateBus = useCallback(() => {
        if (routes.length < 2) return;

        const start = routes[currentSegment];
        const end = routes[(currentSegment + 1) % routes.length];
        const distance = calculateDistance(start, end);
        const ANIMATION_DURATION = distance / 0.01;
        let startTime: number;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const fraction = Math.min(elapsed / ANIMATION_DURATION, 1);

            setBusPosition(interpolate(start, end, fraction));

            if (fraction < 1) {
                requestAnimationFrame(animate);
            } else {
                setCurrentSegment((prev) => (prev + 1) % (routes.length - 1));
            }
        };

        requestAnimationFrame(animate);
    }, [routes, currentSegment]);

    useEffect(() => {
        fetch('/src/assets/shapes.txt')
            .then(response => response.text())
            .then(data => {
                const shapes = parseGTFSShapes(data);
                const firstShapeId = Object.keys(shapes)[0];
                const points = shapes[firstShapeId].map(point => ({
                    lat: point.lat,
                    lng: point.lng
                }));
                const smoothedPoints = preprocessShapePoints(points);
                setRoutes(smoothedPoints);

                // Calculate center point from shape points
                if (smoothedPoints.length > 0) {
                    setBusPosition(smoothedPoints[0]);
                    const midPoint = Math.floor(smoothedPoints.length / 2);
                    setCenter(smoothedPoints[midPoint]);
                }
            })
            .catch(error => console.error('Error loading shapes:', error));
    }, []);

    useEffect(() => {
        if (routes.length > 0) {
            animateBus();
        }
    }, [currentSegment, routes, animateBus]);

    return isLoaded ? (
        <div className="absolute inset-0 flex justify-center items-center bg-gray-100 h-screen w-screen">
            <GoogleMap
                mapContainerClassName="w-[60vw] h-[60vh] rounded-xl shadow-md"
                center={center}
                zoom={15}
            >
                {routes.length > 0 && (
                    <>
                        <Polyline
                            path={routes}
                            options={{
                                strokeColor: '#3b82f6',
                                strokeOpacity: 0.7,
                                strokeWeight: 5,
                                geodesic: true,
                                icons: [
                                    {
                                        icon: {
                                            path: google.maps.SymbolPath.CIRCLE,
                                            scale: 1,
                                        },
                                        repeat: '10px',
                                    }]
                            }}
                        />
                        <Marker
                            position={busPosition}
                            icon={{
                                url: 'https://maps.google.com/mapfiles/ms/icons/bus.png'
                            }}
                        />
                    </>
                )}
            </GoogleMap>
        </div>
    ) : <p>Loading Map...</p>;
}