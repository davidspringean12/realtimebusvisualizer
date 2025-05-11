import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { JSX, useEffect, useState, useCallback, useRef } from 'react';
import { parseGTFSShapes } from "../utils/gtfsParser";
import { preprocessShapePoints } from "../utils/shapeSmoothing";
import { RouteSelector } from "../components/RouteSelector";

// Simple type for map objects
export default function MapView(): JSX.Element {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    const [routes, setRoutes] = useState<Record<string, google.maps.LatLngLiteral[]>>({});
    const [selectedRouteId, setSelectedRouteId] = useState<string>('');
    const [currentSegment, setCurrentSegment] = useState(0);
    const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });

    // Map and objects references
    const mapRef = useRef<google.maps.Map | null>(null);
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const animationRef = useRef<number | null>(null);

    // Function to calculate distance between two points
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

    // Function to interpolate between two points
    const interpolate = (
        start: google.maps.LatLngLiteral,
        end: google.maps.LatLngLiteral,
        fraction: number
    ): google.maps.LatLngLiteral => ({
        lat: start.lat + (end.lat - start.lat) * fraction,
        lng: start.lng + (end.lng - start.lng) * fraction
    });

    // Clean up animation frame
    const stopAnimation = useCallback(() => {
        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    // Function to clear map objects
    const clearMapObjects = useCallback(() => {
        // Clear polyline
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }

        // Clear marker
        if (markerRef.current) {
            markerRef.current.setMap(null);
            markerRef.current = null;
        }

        // Stop animations
        stopAnimation();
    }, [stopAnimation]);

    // Draw route on map
    const drawRoute = useCallback((routeId: string) => {
        if (!mapRef.current || !routes[routeId]) return;

        // Clear previous objects first
        clearMapObjects();

        // Create new polyline
        polylineRef.current = new google.maps.Polyline({
            path: routes[routeId],
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 5,
            map: mapRef.current
        });

        // Create new marker for bus
        if (routes[routeId].length > 0) {
            markerRef.current = new google.maps.Marker({
                position: routes[routeId][0],
                map: mapRef.current,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/bus.png'
                }
            });
        }
    }, [routes, clearMapObjects]);

    // Bus animation
    const animateBus = useCallback(() => {
        if (!selectedRouteId || !routes[selectedRouteId] || routes[selectedRouteId].length < 2) return;
        if (!markerRef.current) return;

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

            const newPosition = interpolate(start, end, fraction);
            // Update marker position
            if (markerRef.current) {
                markerRef.current.setPosition(newPosition);
            }

            if (fraction < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setCurrentSegment((prev) => (prev + 1) % (currentRoute.length - 1));
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [routes, currentSegment, selectedRouteId]);

    // Load data
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
                });

                setRoutes(processedRoutes);

                // Set initial route
                if (Object.keys(processedRoutes).length > 0) {
                    const firstRouteId = Object.keys(processedRoutes)[0];
                    if (processedRoutes[firstRouteId]?.length > 0) {
                        const midPoint = Math.floor(processedRoutes[firstRouteId].length / 2);
                        setCenter(processedRoutes[firstRouteId][midPoint]);
                    }
                }
            })
            .catch(error => console.error('Error fetching shapes:', error));

        // Cleanup on unmount
        return () => {
            clearMapObjects();
        };
    }, [clearMapObjects]);

    // Handle route change
    const handleRouteChange = useCallback((routeId: string) => {
        setSelectedRouteId(routeId);
        setCurrentSegment(0);

        if (isLoaded && mapRef.current) {
            drawRoute(routeId);

            if (routes[routeId]?.length > 0) {
                const midPoint = Math.floor(routes[routeId].length / 2);
                setCenter(routes[routeId][midPoint]);
            }
        }
    }, [isLoaded, routes, drawRoute]);

    // Animation effect
    useEffect(() => {
        if (selectedRouteId && routes[selectedRouteId]?.length > 0 && markerRef.current) {
            stopAnimation();
            animateBus();
        }

        return () => {
            stopAnimation();
        };
    }, [currentSegment, selectedRouteId, routes, animateBus, stopAnimation]);

    // Handle map load
    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;

        // Draw initial route if we have one selected
        if (selectedRouteId && routes[selectedRouteId]) {
            drawRoute(selectedRouteId);
        }
    }, [selectedRouteId, routes, drawRoute]);

    // Effect to handle initial route selection once routes are loaded
    useEffect(() => {
        if (routes && Object.keys(routes).length > 0 && !selectedRouteId) {
            const firstRouteId = Object.keys(routes)[0];
            setSelectedRouteId(firstRouteId);

            if (mapRef.current) {
                drawRoute(firstRouteId);
            }
        }
    }, [routes, selectedRouteId, drawRoute]);

    if (!isLoaded) {
        return <p>Loading Map...</p>;
    }

    return (
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
                onLoad={onMapLoad}
                options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false
                }}
            >
                {/* No children elements - we're creating map objects imperatively */}
            </GoogleMap>
        </div>
    );
}