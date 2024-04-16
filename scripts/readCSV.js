const fs = require('fs').promises;
const path = require('path');

async function readCSVData(filename) {
    try {
        const dataFolderPath = path.join(__dirname, '..', 'Data');
        const csvFilePath = path.join(dataFolderPath, filename);

        // Read the CSV file
        const data = await fs.readFile(csvFilePath, 'utf8');

        // Process the CSV data (split by lines)
        const rows = data.trim().split('\n');

        // Get headers and remove additional characters
        const headers = rows[0].replace('\r', '').split(',').map(header => header.trim()); // Split by comma and trim spaces

        const csvData = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].replace('\r', '').split(',');
            const entry = {};

            for (let j = 0; j < headers.length; j++) {
                entry[headers[j]] = values[j].trim(); // Trim spaces from values
            }

            csvData.push(entry);
        }
        return csvData;
    } catch (e) {
        console.log("Error in reading CSV file:", e);
    }
}

module.exports = readCSVData;
