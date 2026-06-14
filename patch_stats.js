const fs = require('fs');
const file = 'src/hooks/useTechnicianStats.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace fourHoursFromNow with twentyFourHoursFromNow
code = code.replace(/fourHoursFromNow/g, 'twentyFourHoursFromNow');
code = code.replace(/4 \* 60 \* 60 \* 1000/, '24 * 60 * 60 * 1000');
code = code.replace(/< 4 horas/, '< 24 horas');

fs.writeFileSync(file, code);
