import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { JSX, useEffect, useState, useCallback } from 'react';
import { parseGTFSShapes } from "../utils/gtfsParser";
import { preprocessShapePoints} from "../utils/shapeSmoothing";
import { RouteSelector } from "../components/RouteSelector";

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

    const [routes, setRoutes] = useState<Record<string, google.maps.LatLngLiteral[]>>({});
    const [selectedRouteId, setSelectedRouteId] = useState<string>('');
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
        if (!selectedRouteId || !routes[selectedRouteId] || routes[selectedRouteId].length < 2) return;

        const currentRoute = routes[selectedRouteId];
        const start = currentRoute[currentSegment];
        const end = currentRoute[(currentSegment + 1) % currentRoute.length];
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
                setCurrentSegment((prev) => (prev + 1) % (currentRoute.length - 1));
            }
        };

        requestAnimationFrame(animate);
    }, [routes, currentSegment, selectedRouteId]);

    useEffect(() => {
        fetch('/src/assets/shapes.txt')
            .then(response => response.text())
            .then(data => {
                const shapes = parseGTFSShapes(data);
                const processedRoutes: Record<string, google.maps.LatLngLiteral[]> = {};

                Object.entries(shapes).forEach(([shapeId, points]) => {
                    const routePoints = points.map(point => ({
                        lat: point.lat,
                        lng: point.lng
                    }));
                    processedRoutes[shapeId] = preprocessShapePoints(routePoints);
                })

                setRoutes(processedRoutes);
                const firstRouteId = Object.keys(processedRoutes)[0];
                setSelectedRouteId(firstRouteId);

                if (processedRoutes[firstRouteId]?.length > 0) {
                    setBusPosition(processedRoutes[firstRouteId][0]);
                    const midPoint = Math.floor(processedRoutes[firstRouteId].length / 2);
                    setCenter(processedRoutes[firstRouteId][midPoint]);
                }
            })
            .catch(error => console.error('Error fetching shapes:', error));
    }, []);

    useEffect(() => {
        if (selectedRouteId && routes[selectedRouteId]?.length > 0) {
            animateBus();
        }
    }, [currentSegment, routes, animateBus, selectedRouteId]);

    const handleRouteChange = (routeId: string) => {
        setSelectedRouteId(routeId);
        setCurrentSegment(0);
        if (routes[routeId]?.length > 0) {
            setBusPosition(routes[routeId][0]);
            const midPoint = Math.floor(routes[routeId].length / 2);
            setCenter(routes[routeId][midPoint]);
        }
    }

    return isLoaded ? (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-gray-100 h-screen w-screen">
            <RouteSelector
                routes={routes}
                selectedRouteId={selectedRouteId}
                onRouteChange={handleRouteChange}
            />
            <GoogleMap
                mapContainerClassName="w-[60vw] h-[60vh] rounded-xl shadow-md"
                center={center}
                zoom={15}
            >
                {selectedRouteId && routes[selectedRouteId] && (
                    <>
                        <Polyline
                            key={selectedRouteId}
                            path={routes[selectedRouteId]}
                            options={{
                                strokeColor: '#3b82f6',
                                strokeOpacity: 0.7,
                                strokeWeight: 5,
                                geodesic: true,
                                icons: [{
                                    icon: {
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 1,
                                    },
                                    repeat: '10px',
                                }]
                            }}
                        />
                        <Marker
                            key={`bus-${selectedRouteId}`}
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

// Can you help me with optimizing the bus animation logic? The current implementation uses requestAnimationFrame, but it could be improved for smoother animations and better performance. Also, consider adding a loading state while the map is being fetched.</p>