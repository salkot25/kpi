const https = require('https');

const url = 'https://docs.google.com/spreadsheets/d/1vV0b8QuIwj6KwHr39gQL7H0C4OiqqpL5OCWvtnMJ-us/export?format=csv&gid=1164804451';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const lines = data.split('\n');
    console.log('Total lines downloaded:', lines.length);
    console.log('First 15 lines:');
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      console.log(`Row ${i}: ${lines[i]}`);
    }
  });
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
