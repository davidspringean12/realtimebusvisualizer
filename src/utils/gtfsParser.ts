interface ShapePoint {
    lat: number;
    lng: number;
    sequence: number;
}

interface ShapesDict {
    [shape_id: string]: ShapePoint[];
}

export function parseGTFSShapes(shapesData: string): ShapesDict {
    const lines: string[] = shapesData.split('\n').slice(1); // Skip header
    const shapes: ShapesDict = {};

    lines.forEach((line: string) => {
        if (!line) return;
        const [shape_id, lat, lon, sequence]: string[] = line.split(',');

        if (!shapes[shape_id]) {
            shapes[shape_id] = [];
        }

        shapes[shape_id].push({
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            sequence: parseInt(sequence, 10)
        });
    });

    // Sort points by sequence
    Object.values(shapes).forEach((points: ShapePoint[]) => {
        points.sort((a, b) => a.sequence - b.sequence);
    });

    return shapes;
}