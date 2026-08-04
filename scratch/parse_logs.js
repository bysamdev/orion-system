const fs = require('fs');
const text = fs.readFileSync('.system_generated/steps/3800/output.txt', 'utf8');
const jsonStr = text.match(/<untrusted-data[^>]*>([\s\S]*?)<\/untrusted-data[^>]*>/)[1];
const data = JSON.parse(jsonStr);
data.result.forEach(log => {
  if (log.function_id === '0c4b0c8b-b9c7-4881-8267-1829cfa49ab9' || log.level === 'error' || log.level === 'fatal') {
    console.log(`[${log.timestamp}] ${log.level || log.status_code}: ${log.event_message}`);
  }
});
