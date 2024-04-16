const fs = require('fs').promises;
const path = require('path');

async function writeCSVData(filename, csvData) {
    try {
        const dataFolderPath = path.join(__dirname, '..', 'Data');
        const csvFilePath = path.join(dataFolderPath, filename);

        // Add "result" header to the existing headers
        const headers = Object.keys(csvData[0]);
       

        // Create CSV content
        const csvContent = [headers.join(',')];
        for (const entry of csvData) {
            const values = headers.map(header => entry[header]);
            csvContent.push(values.join(','));
        }

        // Write to the CSV file
        await fs.writeFile(csvFilePath, csvContent.join('\n'), 'utf8');

        console.log('CSV file updated with "result" column.');
    } catch (error) {
        console.error('Error writing to CSV file:', error);
    }
}

module.exports = writeCSVData;
