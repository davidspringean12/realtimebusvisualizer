import { LatLngLiteral } from '@googlemaps/google-maps-services-js';
import {JSX} from "react";

interface RouteSelectorProps {
    routes: Record<string, LatLngLiteral[]>;
    selectedRouteId: string;
    onRouteChange: (routeId: string) => void;
}

export function RouteSelector({ routes, selectedRouteId, onRouteChange }: RouteSelectorProps): JSX.Element {
    if (!routes || Object.keys(routes).length === 0) {
        return <select className="mb-4 px-4 py-2 border rounded shadow-sm" disabled>
            <option>No routes available</option>
        </select>;
    }

    return (
        <select
            className="mb-4 px-4 py-2 border rounded shadow-sm"
            value={selectedRouteId}
            onChange={(e) => onRouteChange(e.target.value)}
        >
            {Object.keys(routes).map((routeId) => (
                <option key={routeId} value={routeId}>
                    Route {routeId}
                </option>
            ))}
        </select>
    );
}

