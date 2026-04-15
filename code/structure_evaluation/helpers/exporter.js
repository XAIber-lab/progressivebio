// Function to convert a batch of results to CSV
function batchToCSV(batch, separator = ',') {
    return batch.map(row => {
        return Object.values(row).map(value => {
            if (Array.isArray(value) || typeof value === 'object') {
                return `"${JSON.stringify(value)}"`;
                //TODO fix so arrays don't have commas and objects only single quotes
            }
            return typeof value === 'string' ? `"${value}"` : value;
        }).join(separator);
    }).join('\n');
}

// Function to write data in batches
function writeCSVInBatches(path, fs, data, dirPath, batchSize = 1000, separator = ',') {
    const filePath = path.join(dirPath, "result.csv");
    const writeStream = fs.createWriteStream(filePath, {flags: 'w'}); // 'w' flag to overwrite or create new

    // Write headers first
    const headers = Object.keys(data[0]);
    writeStream.write(headers.join(separator) + '\n');

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const csvBatch = batchToCSV(batch, separator);
        writeStream.write(csvBatch + '\n');
    }

    writeStream.end(); // Close the stream
    writeStream.on('finish', () => {
        console.log('CSV File written successfully');
    });
    writeStream.on('error', (error) => {
        console.error('Error writing CSV file:', error);
    });
}

// Function to write data in batches to a JSON file
function writeJSONInBatches(path, fs, data, dirPath, batchSize = 1000) {
    const filePath = path.join(dirPath, "result.json");
    const writeStream = fs.createWriteStream(filePath, {flags: 'w'}); // 'w' flag to overwrite or create new

    let batchedData = [];
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        batchedData.push(batch);
    }
    //console.log(batchedData)

    writeStream.write('[')
    for (let i = 0; i < batchedData.length; i++) {
        const jsonData = JSON.stringify(batchedData[i]);
        //console.log(jsonData.slice(1, -1))
        writeStream.write(jsonData.slice(1, -1));
        // remove first and last charcter since they would be '[' and ']' from the array
    }
    writeStream.write(']')

    writeStream.end(); // Close the stream
    writeStream.on('finish', () => {
        console.log('JSON File written successfully\n');
    });
    writeStream.on('error', (error) => {
        console.error('Error writing JSON file:', error);
    });
}
