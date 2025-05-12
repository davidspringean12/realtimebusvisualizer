import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { JSX, useEffect, useState, useCallback, useRef } from 'react';
import { parseGTFSShapes } from "../utils/gtfsParser";
import {
    calculateDistance,
    calculateSpeedProfile,
    preprocessShapePoints
} from "../utils/shapeSmoothing";
import { SpeedProfile } from "../types/movement";
import { RouteSelector } from "../components/RouteSelector";

const BASE_SPEED = 0.01; // Base speed for bus animation

declare global {
    interface Window {
        google: typeof google;
    }
}

// Simple type for map objects
export default function MapView(): JSX.Element {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    console.log('Google Maps API Key:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

    const [routes, setRoutes] = useState<Record<string, google.maps.LatLngLiteral[]>>({});
    const [selectedRouteId, setSelectedRouteId] = useState<string>('');
    const [currentSegment, setCurrentSegment] = useState(0);
    const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });

    // Map and objects references
    const mapRef = useRef<google.maps.Map | null>(null);
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const animationRef = useRef<number | null>(null);

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

        const speedData: SpeedProfile = calculateSpeedProfile(
            currentRoute,
            currentSegment,
            3
        );

        const distance = calculateDistance(start, end);
        const ANIMATION_DURATION = distance / (BASE_SPEED * speedData.currentSpeed);

        let startTime: number;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const fraction = Math.min(elapsed / ANIMATION_DURATION, 1);

            const newPosition = interpolate(start, end, fraction);
            // Update marker position
            if (markerRef.current) {
                markerRef.current.setPosition(newPosition);

                const heading = google.maps.geometry.spherical.computeHeading(
                    new google.maps.LatLng(start.lat, start.lng),
                    new google.maps.LatLng(end.lat, end.lng)
                );

                const scale = 4 + (speedData.currentSpeed * 2);
                markerRef.current.setIcon({
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: scale,
                    rotation: heading,
                    fillColor: speedData.currentSpeed < 0.5 ? '#f59e0b' : '#3b82f6',
                    fillOpacity: 0.8,
                    strokeWeight: 2,
                    strokeColor: '#2563eb',
                });
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
                    disableDefaultUI: true,
                    zoomControl: true,
                    zoomControlOptions: {
                        position: window.google.maps.ControlPosition.RIGHT_CENTER
                    },
                    streetViewControl: true,
                    streetViewControlOptions: {
                        position: window.google.maps.ControlPosition.RIGHT_BOTTOM
                    },
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                        position: window.google.maps.ControlPosition.TOP_RIGHT,
                        style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                        mapTypeIds: [
                            window.google.maps.MapTypeId.ROADMAP,
                            window.google.maps.MapTypeId.SATELLITE,
                            window.google.maps.MapTypeId.HYBRID
                        ]
                    }
                }}
            >
                {/* No children elements - we're creating map objects imperatively */}
            </GoogleMap>
        </div>
    );
}
