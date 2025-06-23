export async function loadCSVToFloat32Array(filePath) {
    try {
        // Fetch the CSV file
        const response = await fetch(filePath);
        const csvText = await response.text();
        
        // Parse the CSV
        const rows = csvText.trim().split('\n');
        const floatArray = new Float32Array(32 * 32);
        
        for (let y = 0; y < 32; y++) {
            const values = rows[y].split(',');
            for (let x = 0; x < 32; x++) {
                floatArray[y * 32 + x] = parseFloat(values[x]);
            }
        }
        
        return floatArray;
    } catch (error) {
        console.error('Error loading or parsing CSV:', error);
        throw error;
    }
}

export function saveFloat32ArrayAsCSV(floatArray, fileName = 'data.csv') {
    if (floatArray.length !== 32 * 32) {
        throw new Error('Array length must be 1024 (32x32)');
    }

    let csvContent = '';

    // Convert to 32x32 CSV format
    for (let y = 0; y < 32; y++) {
        const row = [];
        for (let x = 0; x < 32; x++) {
            row.push(floatArray[y * 32 + x]);
        }
        csvContent += row.join(',') + '\n';
    }

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
