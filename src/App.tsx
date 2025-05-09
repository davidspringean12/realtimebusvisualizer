import MapView from './assets/MapView';
import {JSX} from "react";

function App(): JSX.Element {
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start py-6 px-4">
            <header className="w-full max-w-5xl text-center mb-6">
                <h1 className="text-4xl font-extrabold text-blue-700 mb-2">City Bus Tracker</h1>
                <p className="text-gray-600 text-lg">Track live bus routes and locations on the map</p>
            </header>

            <main className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-4">
                <MapView />
            </main>
        </div>
    );
}

export default App;