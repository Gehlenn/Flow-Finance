const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3001,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  process.stdout.write(`STATUS: ${res.statusCode}\n`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', function(err) {
  process.stderr.write('ERROR\n');
  process.exit(1);
});

request.end();
